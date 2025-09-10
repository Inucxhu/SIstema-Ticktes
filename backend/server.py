from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from emergentintegrations.llm.chat import LlmChat, UserMessage
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Soporte360 API", description="Sistema inteligente de gestión de tickets")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class EstadoTicket(str, Enum):
    NUEVO = "Nuevo"
    EN_PROGRESO = "En Progreso"
    RESUELTO = "Resuelto"
    CERRADO = "Cerrado"

class PrioridadTicket(str, Enum):
    ALTA = "Alta"
    MEDIA = "Media"
    BAJA = "Baja"

class CategoriaTicket(str, Enum):
    HARDWARE = "Hardware"
    SOFTWARE = "Software"
    RED = "Red"
    SEGURIDAD = "Seguridad"
    ACCESO = "Acceso"

class DepartamentoTicket(str, Enum):
    TI = "TI"
    SOPORTE = "Soporte"
    INFRAESTRUCTURA = "Infraestructura"

# Models
class Ticket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titulo: str
    descripcion: str
    estado: EstadoTicket = EstadoTicket.NUEVO
    prioridad: Optional[PrioridadTicket] = None
    categoria: Optional[CategoriaTicket] = None
    departamento: Optional[DepartamentoTicket] = None
    tiempo_estimado: Optional[str] = None
    usuario_email: str
    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    fecha_actualizacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TicketCreate(BaseModel):
    titulo: str
    descripcion: str
    usuario_email: str

class TicketUpdate(BaseModel):
    estado: Optional[EstadoTicket] = None
    prioridad: Optional[PrioridadTicket] = None
    categoria: Optional[CategoriaTicket] = None
    departamento: Optional[DepartamentoTicket] = None

class MetricasTickets(BaseModel):
    total_tickets: int
    tickets_por_estado: dict
    tickets_por_prioridad: dict
    tickets_por_categoria: dict
    tickets_por_departamento: dict
    tiempo_promedio_resolucion: float

# Helper functions
def prepare_for_mongo(data):
    if isinstance(data.get('fecha_creacion'), datetime):
        data['fecha_creacion'] = data['fecha_creacion'].isoformat()
    if isinstance(data.get('fecha_actualizacion'), datetime):
        data['fecha_actualizacion'] = data['fecha_actualizacion'].isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item.get('fecha_creacion'), str):
        item['fecha_creacion'] = datetime.fromisoformat(item['fecha_creacion'])
    if isinstance(item.get('fecha_actualizacion'), str):
        item['fecha_actualizacion'] = datetime.fromisoformat(item['fecha_actualizacion'])
    return item

# AI Classification function
async def clasificar_ticket_con_ia(titulo: str, descripcion: str) -> dict:
    try:
        chat = LlmChat(
            api_key=os.environ.get('EMERGENT_LLM_KEY'),
            session_id=f"ticket-classification-{uuid.uuid4()}",
            system_message="""Eres un experto en clasificación de tickets de soporte técnico. 
            Analiza el título y descripción del ticket y clasifícalo según:
            
            PRIORIDAD: Alta, Media, Baja
            CATEGORIA: Hardware, Software, Red, Seguridad, Acceso
            DEPARTAMENTO: TI, Soporte, Infraestructura
            TIEMPO_ESTIMADO: Estima en horas (ej: "2-4 horas", "1-2 días", "1 semana")
            
            Responde SOLO en formato JSON exactamente así:
            {
                "prioridad": "Alta/Media/Baja",
                "categoria": "Hardware/Software/Red/Seguridad/Acceso",
                "departamento": "TI/Soporte/Infraestructura", 
                "tiempo_estimado": "estimación en texto"
            }"""
        ).with_model("openai", "gpt-4o-mini")
        
        user_message = UserMessage(
            text=f"TÍTULO: {titulo}\n\nDESCRIPCIÓN: {descripcion}"
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON response
        import json
        clasificacion = json.loads(response.strip())
        
        return {
            "prioridad": clasificacion.get("prioridad", "Media"),
            "categoria": clasificacion.get("categoria", "Software"),
            "departamento": clasificacion.get("departamento", "Soporte"),
            "tiempo_estimado": clasificacion.get("tiempo_estimado", "2-4 horas")
        }
        
    except Exception as e:
        logger.error(f"Error en clasificación IA: {e}")
        # Fallback clasificación básica
        return {
            "prioridad": "Media",
            "categoria": "Software", 
            "departamento": "Soporte",
            "tiempo_estimado": "2-4 horas"
        }

# Routes
@api_router.get("/")
async def root():
    return {"message": "Soporte360 API - Sistema inteligente de gestión de tickets"}

@api_router.post("/tickets", response_model=Ticket)
async def crear_ticket(ticket_data: TicketCreate):
    # Clasificación automática con IA
    clasificacion = await clasificar_ticket_con_ia(ticket_data.titulo, ticket_data.descripcion)
    
    # Crear ticket con clasificación
    ticket_dict = ticket_data.dict()
    ticket_dict.update(clasificacion)
    ticket_obj = Ticket(**ticket_dict)
    
    # Guardar en MongoDB
    ticket_mongo = prepare_for_mongo(ticket_obj.dict())
    await db.tickets.insert_one(ticket_mongo)
    
    return ticket_obj

@api_router.get("/tickets", response_model=List[Ticket])
async def obtener_tickets():
    tickets = await db.tickets.find().sort("fecha_creacion", -1).to_list(100)
    return [Ticket(**parse_from_mongo(ticket)) for ticket in tickets]

@api_router.get("/tickets/{ticket_id}", response_model=Ticket)
async def obtener_ticket(ticket_id: str):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    return Ticket(**parse_from_mongo(ticket))

@api_router.put("/tickets/{ticket_id}", response_model=Ticket)
async def actualizar_ticket(ticket_id: str, update_data: TicketUpdate):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    
    # Actualizar campos
    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    update_dict["fecha_actualizacion"] = datetime.now(timezone.utc).isoformat()
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_dict})
    
    # Obtener ticket actualizado
    updated_ticket = await db.tickets.find_one({"id": ticket_id})
    return Ticket(**parse_from_mongo(updated_ticket))

@api_router.get("/metricas", response_model=MetricasTickets)
async def obtener_metricas():
    # Obtener todos los tickets
    tickets = await db.tickets.find().to_list(1000)
    
    if not tickets:
        return MetricasTickets(
            total_tickets=0,
            tickets_por_estado={},
            tickets_por_prioridad={},
            tickets_por_categoria={},
            tickets_por_departamento={},
            tiempo_promedio_resolucion=0.0
        )
    
    # Calcular métricas
    total_tickets = len(tickets)
    
    # Contar por estado
    estados = {}
    for ticket in tickets:
        estado = ticket.get('estado', 'Nuevo')
        estados[estado] = estados.get(estado, 0) + 1
    
    # Contar por prioridad  
    prioridades = {}
    for ticket in tickets:
        prioridad = ticket.get('prioridad', 'Media')
        prioridades[prioridad] = prioridades.get(prioridad, 0) + 1
    
    # Contar por categoría
    categorias = {}
    for ticket in tickets:
        categoria = ticket.get('categoria', 'Software')
        categorias[categoria] = categorias.get(categoria, 0) + 1
    
    # Contar por departamento
    departamentos = {}
    for ticket in tickets:
        departamento = ticket.get('departamento', 'Soporte')
        departamentos[departamento] = departamentos.get(departamento, 0) + 1
    
    return MetricasTickets(
        total_tickets=total_tickets,
        tickets_por_estado=estados,
        tickets_por_prioridad=prioridades,
        tickets_por_categoria=categorias,
        tickets_por_departamento=departamentos,
        tiempo_promedio_resolucion=2.5  # Placeholder
    )

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()