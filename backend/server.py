from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from emergentintegrations.llm.chat import LlmChat, UserMessage
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Security
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Soporte360 API", description="Sistema inteligente de gestión de tickets con autenticación")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    MASTER_ADMIN = "Administrador Maestro"
    ADMIN = "Administrador"
    SUPPORT = "Soporte"
    END_USER = "Usuario final"

class GrupoSoporte(str, Enum):
    SOPORTE_GENERAL = "Soporte"
    SOPORTE_TECNICO = "Soporte Técnico"
    SOPORTE_SISTEMAS = "Soporte Sistemas"

class EstadoTicket(str, Enum):
    NUEVO = "Nuevo"
    ASIGNADO = "Asignado"
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

class CampanasEnum(str, Enum):
    PLATA_CARD = "Plata card"
    PEPSICO = "Pepsico"
    SXM = "SXM"
    YYC = "YYC"
    BOTS_IA = "Bots IA"

# Auth Models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: UserRole
    grupo_soporte: Optional[GrupoSoporte] = None  # Solo para usuarios de soporte
    campana: Optional[CampanasEnum] = None  # Solo para usuarios finales

class UserLogin(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    campana: Optional[CampanasEnum] = None
    grupo_soporte: Optional[GrupoSoporte] = None

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    full_name: Optional[str] = None  # Make it optional for backward compatibility
    role: UserRole
    grupo_soporte: Optional[GrupoSoporte] = None
    campana: Optional[CampanasEnum] = None
    is_active: bool = True
    created_by: Optional[str] = None  # ID del usuario que lo creó
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# Ticket Models (updated)
class Ticket(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    titulo: str
    descripcion: str
    estado: EstadoTicket = EstadoTicket.NUEVO
    prioridad: Optional[PrioridadTicket] = None
    categoria: Optional[CategoriaTicket] = None
    departamento: Optional[DepartamentoTicket] = None
    tiempo_estimado: Optional[str] = None
    usuario_id: Optional[str] = None  # Make optional for backward compatibility
    usuario_email: str
    campana: Optional[CampanasEnum] = None  # Campaña del usuario
    asignado_a: Optional[str] = None  # ID del usuario de soporte asignado
    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    fecha_actualizacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TicketCreate(BaseModel):
    titulo: str
    descripcion: str

class TicketUpdate(BaseModel):
    estado: Optional[EstadoTicket] = None
    prioridad: Optional[PrioridadTicket] = None
    categoria: Optional[CategoriaTicket] = None
    departamento: Optional[DepartamentoTicket] = None
    asignado_a: Optional[str] = None

class MetricasTickets(BaseModel):
    total_tickets: int
    tickets_por_estado: dict
    tickets_por_prioridad: dict
    tickets_por_categoria: dict
    tickets_por_departamento: dict
    tickets_por_campana: dict
    tiempo_promedio_resolucion: float

# Helper functions for passwords
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Helper functions for MongoDB
def prepare_for_mongo(data):
    if isinstance(data.get('fecha_creacion'), datetime):
        data['fecha_creacion'] = data['fecha_creacion'].isoformat()
    if isinstance(data.get('fecha_actualizacion'), datetime):
        data['fecha_actualizacion'] = data['fecha_actualizacion'].isoformat()
    if isinstance(data.get('created_at'), datetime):
        data['created_at'] = data['created_at'].isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item.get('fecha_creacion'), str):
        item['fecha_creacion'] = datetime.fromisoformat(item['fecha_creacion'])
    if isinstance(item.get('fecha_actualizacion'), str):
        item['fecha_actualizacion'] = datetime.fromisoformat(item['fecha_actualizacion'])
    if isinstance(item.get('created_at'), str):
        item['created_at'] = datetime.fromisoformat(item['created_at'])
    return item

# Auth functions
async def get_user_from_db(username: str):
    user = await db.users.find_one({"username": username})
    if user:
        return UserInDB(**parse_from_mongo(user))
    return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await get_user_from_db(username=username)
    if user is None:
        raise credentials_exception
    return User(**user.dict())

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def require_role(allowed_roles: List[UserRole]):
    def role_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker

# Initialize Master User
async def create_master_user():
    """Create the master admin user Eduardo Cruz if it doesn't exist"""
    existing_master = await db.users.find_one({"email": "ecruz@hccenters.com"})
    if not existing_master:
        master_data = {
            "username": "ecruz",
            "email": "ecruz@hccenters.com",
            "full_name": "Eduardo Cruz",
            "role": UserRole.MASTER_ADMIN,
            "hashed_password": get_password_hash("admin123"),
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "id": str(uuid.uuid4())
        }
        
        await db.users.insert_one(master_data)
        logger.info("✅ Master admin user Eduardo Cruz created successfully")
        print("🎯 MASTER ADMIN CREATED:")
        print("   Username: ecruz")
        print("   Email: ecruz@hccenters.com") 
        print("   Password: admin123")
        print("   Role: Administrador Maestro")
    else:
        # Update existing master user to include full_name if missing
        if 'full_name' not in existing_master or not existing_master.get('full_name'):
            await db.users.update_one(
                {"email": "ecruz@hccenters.com"},
                {"$set": {"full_name": "Eduardo Cruz"}}
            )
            logger.info("✅ Updated master admin user with full_name")
        logger.info("✅ Master admin user already exists")

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

# Auth Routes
@api_router.post("/auth/register", response_model=User)
async def register_user(
    user_data: UserCreate,
    current_user: User = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    """Only master admin and admin users can create new users"""
    # Check if user exists
    existing_user = await get_user_from_db(user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )
    
    # Check email
    existing_email = await db.users.find_one({"email": user_data.email})
    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Validate grupo_soporte for support users
    if user_data.role == UserRole.SUPPORT and not user_data.grupo_soporte:
        raise HTTPException(
            status_code=400,
            detail="Grupo de soporte is required for support users"
        )
    
    # Validate campaña for end users
    if user_data.role == UserRole.END_USER and not user_data.campana:
        raise HTTPException(
            status_code=400,
            detail="Campaña is required for end users"
        )
    
    # Only master admin can create other admins
    if user_data.role in [UserRole.MASTER_ADMIN, UserRole.ADMIN] and current_user.role != UserRole.MASTER_ADMIN:
        raise HTTPException(
            status_code=403,
            detail="Only master admin can create administrator users"
        )
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    user_dict = user_data.dict()
    user_dict.pop("password")
    user_dict["created_by"] = current_user.id
    user_obj = User(**user_dict)
    
    user_in_db = UserInDB(**user_obj.dict(), hashed_password=hashed_password)
    user_mongo = prepare_for_mongo(user_in_db.dict())
    
    await db.users.insert_one(user_mongo)
    return user_obj

@api_router.post("/auth/register-public", response_model=dict)
async def register_public():
    """Public registration disabled - only admins can create users"""
    raise HTTPException(
        status_code=403,
        detail="Public registration is disabled. Contact your administrator to create an account."
    )

@api_router.post("/auth/login", response_model=Token)
async def login_user(user_credentials: UserLogin):
    user = await get_user_from_db(user_credentials.username)
    if not user or not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    user_public = User(**user.dict())
    return Token(access_token=access_token, token_type="bearer", user=user_public)

@api_router.get("/auth/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user

@api_router.get("/auth/campanias", response_model=List[str])
async def get_campanias():
    return [campana.value for campana in CampanasEnum]

@api_router.get("/auth/grupos-soporte", response_model=List[str])
async def get_grupos_soporte():
    return [grupo.value for grupo in GrupoSoporte]

# Ticket Routes (Protected)
@api_router.post("/tickets", response_model=Ticket)
async def crear_ticket(
    ticket_data: TicketCreate, 
    current_user: User = Depends(get_current_active_user)
):
    # Only end users can create tickets
    if current_user.role != UserRole.END_USER:
        raise HTTPException(
            status_code=403,
            detail="Only end users can create tickets"
        )
    
    # Clasificación automática con IA
    clasificacion = await clasificar_ticket_con_ia(ticket_data.titulo, ticket_data.descripcion)
    
    # Crear ticket con clasificación
    ticket_dict = ticket_data.dict()
    ticket_dict.update(clasificacion)
    ticket_dict.update({
        "usuario_id": current_user.id,
        "usuario_email": current_user.email,
        "campana": current_user.campana
    })
    
    ticket_obj = Ticket(**ticket_dict)
    
    # Guardar en MongoDB
    ticket_mongo = prepare_for_mongo(ticket_obj.dict())
    await db.tickets.insert_one(ticket_mongo)
    
    return ticket_obj

@api_router.get("/tickets", response_model=List[Ticket])
async def obtener_tickets(current_user: User = Depends(get_current_active_user)):
    # Master Admin and Admin see all tickets, Support sees all, End users see only their tickets
    if current_user.role in [UserRole.MASTER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT]:
        tickets = await db.tickets.find().sort("fecha_creacion", -1).to_list(100)
    else:
        tickets = await db.tickets.find({"usuario_id": current_user.id}).sort("fecha_creacion", -1).to_list(100)
    
    return [Ticket(**parse_from_mongo(ticket)) for ticket in tickets]

@api_router.get("/tickets/{ticket_id}", response_model=Ticket)
async def obtener_ticket(ticket_id: str, current_user: User = Depends(get_current_active_user)):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    
    # Check permissions
    if current_user.role == UserRole.END_USER and ticket["usuario_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    return Ticket(**parse_from_mongo(ticket))

@api_router.put("/tickets/{ticket_id}", response_model=Ticket)
async def actualizar_ticket(
    ticket_id: str, 
    update_data: TicketUpdate,
    current_user: User = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT]))
):
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

@api_router.post("/tickets/{ticket_id}/assign")
async def asignar_ticket(
    ticket_id: str,
    current_user: User = Depends(require_role([UserRole.SUPPORT]))
):
    ticket = await db.tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    
    # Assign ticket to current support user
    update_data = {
        "asignado_a": current_user.id,
        "estado": EstadoTicket.ASIGNADO,
        "fecha_actualizacion": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tickets.update_one({"id": ticket_id}, {"$set": update_data})
    
    updated_ticket = await db.tickets.find_one({"id": ticket_id})
    return Ticket(**parse_from_mongo(updated_ticket))

@api_router.get("/metricas", response_model=MetricasTickets)
async def obtener_metricas(current_user: User = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT]))):
    # Get all tickets for metrics
    tickets = await db.tickets.find().to_list(1000)
    
    if not tickets:
        return MetricasTickets(
            total_tickets=0,
            tickets_por_estado={},
            tickets_por_prioridad={},
            tickets_por_categoria={},
            tickets_por_departamento={},
            tickets_por_campana={},
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
    
    # Contar por campaña
    campanas = {}
    for ticket in tickets:
        campana = ticket.get('campana', 'N/A')
        campanas[campana] = campanas.get(campana, 0) + 1
    
    return MetricasTickets(
        total_tickets=total_tickets,
        tickets_por_estado=estados,
        tickets_por_prioridad=prioridades,
        tickets_por_categoria=categorias,
        tickets_por_departamento=departamentos,
        tickets_por_campana=campanas,
        tiempo_promedio_resolucion=2.5  # Placeholder
    )

# User management (Admin only)
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))):
    users = await db.users.find().to_list(100)
    result_users = []
    
    for user in users:
        parsed_user = parse_from_mongo(user)
        # Add full_name if missing (backward compatibility)
        if 'full_name' not in parsed_user or not parsed_user['full_name']:
            parsed_user['full_name'] = parsed_user.get('username', 'Usuario')
        
        result_users.append(User(**parsed_user))
    
    return result_users

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    update_data: UserUpdate,
    current_user: User = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    # Find the user to update
    user_to_update = await db.users.find_one({"id": user_id})
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Only master admin can edit other admins
    if user_to_update["role"] in ["Administrador Maestro", "Administrador"] and current_user.role != UserRole.MASTER_ADMIN:
        raise HTTPException(status_code=403, detail="Only master admin can edit administrator users")
    
    # Only master admin can create/edit admin roles
    if update_data.role and update_data.role in [UserRole.MASTER_ADMIN, UserRole.ADMIN] and current_user.role != UserRole.MASTER_ADMIN:
        raise HTTPException(status_code=403, detail="Only master admin can assign administrator roles")
    
    # Prepare update data
    update_dict = {}
    
    # Update email if provided
    if update_data.email:
        # Check if email is already taken by another user
        existing_email = await db.users.find_one({"email": update_data.email, "id": {"$ne": user_id}})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already in use by another user")
        update_dict["email"] = update_data.email
    
    # Update password if provided
    if update_data.password:
        update_dict["hashed_password"] = get_password_hash(update_data.password)
    
    # Update role if provided
    if update_data.role:
        update_dict["role"] = update_data.role
        
        # Clear role-specific fields when changing roles
        if update_data.role != UserRole.END_USER:
            update_dict["campana"] = None
        if update_data.role != UserRole.SUPPORT:
            update_dict["grupo_soporte"] = None
    
    # Update campaña if provided (only for end users)
    if update_data.campana is not None:
        # Get the current/new role
        new_role = update_data.role if update_data.role else user_to_update.get("role")
        if new_role != UserRole.END_USER:
            raise HTTPException(status_code=400, detail="Campaigns can only be assigned to end users")
        update_dict["campana"] = update_data.campana
    
    # Update grupo_soporte if provided (only for support users)
    if update_data.grupo_soporte is not None:
        # Get the current/new role
        new_role = update_data.role if update_data.role else user_to_update.get("role")
        if new_role != UserRole.SUPPORT:
            raise HTTPException(status_code=400, detail="Support groups can only be assigned to support users")
        update_dict["grupo_soporte"] = update_data.grupo_soporte
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No data provided for update")
    
    # Update the user
    await db.users.update_one({"id": user_id}, {"$set": update_dict})
    
    # Return updated user
    updated_user = await db.users.find_one({"id": user_id})
    parsed_user = parse_from_mongo(updated_user)
    
    # Add full_name if missing (backward compatibility)
    if 'full_name' not in parsed_user or not parsed_user['full_name']:
        parsed_user['full_name'] = parsed_user.get('username', 'Usuario')
    
    return User(**parsed_user)

@api_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_role([UserRole.MASTER_ADMIN, UserRole.ADMIN]))
):
    # Can't delete yourself
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Only master admin can delete other admins
    user_to_delete = await db.users.find_one({"id": user_id})
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_to_delete["role"] in ["Administrador Maestro", "Administrador"] and current_user.role != UserRole.MASTER_ADMIN:
        raise HTTPException(status_code=403, detail="Only master admin can delete administrator users")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}

# Basic route
@api_router.get("/")
async def root():
    return {"message": "Soporte360 API - Sistema inteligente con autenticación JWT"}

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

@app.on_event("startup")
async def startup_event():
    """Initialize the master user on startup"""
    await create_master_user()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()