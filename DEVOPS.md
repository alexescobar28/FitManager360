# DevOps Setup Guide - FitManager360

Este documento describe la configuración completa de CI/CD para FitManager360 usando GitHub Actions.

## 🏗️ Arquitectura DevOps

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Developer     │    │  GitHub Actions │    │  Production     │
│   Push Code     │───▶│     CI/CD       │───▶│    Server       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Feature       │    │  Build & Test   │    │   Auto Deploy  │
│   Branch        │    │  Docker Images  │    │   Monitoring    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Configuración Paso a Paso

### 1. Configurar GitHub Repository

1. **Fork o clona el repositorio**
2. **Habilita GitHub Actions** en Settings → Actions
3. **Configura los secrets** en Settings → Secrets and variables → Actions:

#### Secrets Requeridos:

```bash
# Para GitHub Container Registry (automático)
GITHUB_TOKEN  # Se genera automáticamente

# Para DockerHub (opcional)
DOCKERHUB_TOKEN     # Tu token de DockerHub
DOCKERHUB_USERNAME  # Tu username de DockerHub

# Para deployment automático
DEPLOY_SSH_KEY   # Clave SSH privada para acceder al servidor
DEPLOY_USER      # Usuario SSH (ej: ubuntu, root)
DEPLOY_HOST      # IP o dominio del servidor (ej: 192.168.1.100)

# Para notificaciones (opcional)
SLACK_WEBHOOK    # Webhook de Slack para notificaciones
```

### 2. Preparar el Servidor de Producción

#### 2.1 Ejecutar setup inicial:

```bash
# En tu servidor (VPS/EC2)
wget https://raw.githubusercontent.com/tu-usuario/FitManager360/main/scripts/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh
```

#### 2.2 Configurar variables de entorno:

```bash
cd /opt/fitmanager360
cp .env.prod.example .env.prod
nano .env.prod  # Editar con tus valores
```

#### 2.3 Configurar acceso a GitHub Container Registry:

```bash
# Crear token personal de GitHub con permisos read:packages
# Luego ejecutar:
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 3. Configurar SSH para Deployment

#### 3.1 Generar claves SSH (en tu máquina local):

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions"
# Guarda como github-actions-key
```

#### 3.2 Copiar clave pública al servidor:

```bash
ssh-copy-id -i github-actions-key.pub user@your-server-ip
```

#### 3.3 Agregar clave privada a GitHub Secrets:

```bash
cat github-actions-key | base64  # Copia este contenido a DEPLOY_SSH_KEY
```

## 🔄 Flujo de CI/CD

### Trigger Events:

- **Push a `main`**: Deploy automático a producción
- **Push a `develop`**: Build y test
- **Pull Request**: Build y test
- **Tags `v*`**: Release con versionado

### Pipeline Steps:

1. **Detection**: Detecta cambios en cada microservicio
2. **Test**: Ejecuta tests unitarios para servicios modificados
3. **Build**: Construye imágenes Docker solo para servicios con cambios
4. **Push**: Sube imágenes a GitHub Container Registry
5. **Deploy**: Despliega automáticamente en producción (solo desde `main`)
6. **Health Check**: Verifica que los servicios estén funcionando
7. **Notify**: Envía notificaciones del resultado

## 🐳 Estrategia de Contenedores

### GitHub Container Registry:

```bash
# Imágenes se publican como:
ghcr.io/tu-usuario/fitmanager360/auth-service:latest
ghcr.io/tu-usuario/fitmanager360/routine-service:latest
ghcr.io/tu-usuario/fitmanager360/chat-service:latest
ghcr.io/tu-usuario/fitmanager360/stats-service:latest
ghcr.io/tu-usuario/fitmanager360/api-gateway:latest
ghcr.io/tu-usuario/fitmanager360/frontend:latest
```

### DockerHub (alternativo):

```bash
# Imágenes se publican como:
tu-usuario/fitmanager360-auth-service:latest
tu-usuario/fitmanager360-routine-service:latest
# etc...
```

## 🔧 Comandos Útiles

### Desarrollo Local:

```bash
make help           # Ver todos los comandos disponibles
make dev            # Iniciar entorno de desarrollo
make build          # Construir todas las imágenes
make test           # Ejecutar tests
make health         # Verificar salud de servicios
make logs           # Ver logs de todos los servicios
```

### Producción:

```bash
make prod           # Iniciar entorno de producción
make deploy         # Desplegar a producción
make backup         # Hacer backup de MongoDB
make monitor        # Abrir dashboards de monitoreo
```

### Troubleshooting:

```bash
make logs-service SERVICE=auth-service  # Ver logs de un servicio específico
make clean                              # Limpiar recursos Docker
make stop                               # Detener todos los servicios
```

## 📊 Monitoreo y Observabilidad

### Grafana Dashboards:

- **URL**: `http://your-server:3005`
- **User**: `admin` / **Pass**: `admin123`
- **Dashboards**: Métricas de cada microservicio

### Prometheus Metrics:

- **URL**: `http://your-server:9090`
- **Métricas**: CPU, memoria, requests, latencia, etc.

### Logs:

```bash
# Ver logs en tiempo real
docker-compose -f docker-compose.prod.yml logs -f

# Ver logs de un servicio específico
docker-compose -f docker-compose.prod.yml logs -f auth-service
```

## 🔒 Seguridad

### Variables de Entorno:

- Nunca commitear archivos `.env`
- Usar GitHub Secrets para datos sensibles
- Rotar claves regularmente

### Docker Security:

- Imágenes basadas en Alpine Linux
- Usuario no-root en contenedores
- Escaneo de vulnerabilidades automático

### Network Security:

- Red interna para microservicios
- Nginx como reverse proxy
- Rate limiting configurado
- Headers de seguridad

## 🚨 Alertas y Notificaciones

### Configurar Slack:

1. Crear webhook en Slack
2. Agregar URL a `SLACK_WEBHOOK` en GitHub Secrets
3. Las notificaciones se enviarán automáticamente

### Health Checks:

- Cada servicio tiene endpoint `/health`
- Verificación automática post-deployment
- Rollback automático en caso de falla

## 📈 Escalabilidad

### Horizontal Scaling:

```bash
# Escalar un servicio específico
make scale SERVICE=auth-service REPLICAS=3
```

### Load Balancing:

- Nginx distribuye carga entre réplicas
- Health checks antes de routing
- Session affinity cuando sea necesario

## 🔄 Rollback Strategy

### Automático:

- Falla en health checks → rollback automático
- Timeout en deployment → rollback

### Manual:

```bash
# Rollback a versión anterior
docker-compose -f docker-compose.prod.yml pull previous-tag
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Troubleshooting Común

### 1. Falla en Build:

```bash
# Ver logs detallados
docker-compose build --no-cache auth-service
```

### 2. Problemas de Red:

```bash
# Verificar conectividad entre servicios
docker-compose exec auth-service ping mongodb-auth
```

### 3. Problemas de Permisos:

```bash
# Verificar permisos de archivos
ls -la /opt/fitmanager360
sudo chown -R $USER:$USER /opt/fitmanager360
```

### 4. Base de Datos:

```bash
# Conectar a MongoDB
docker exec -it fitmanager_mongodb_auth mongo -u admin -p password123
```

## 🎯 Mejores Prácticas

1. **Commits Semánticos**: Usar conventional commits
2. **Branching**: GitFlow o GitHub Flow
3. **Testing**: Tests antes de merge
4. **Security**: Escaneo de dependencias
5. **Monitoring**: Dashboards actualizados
6. **Documentation**: README actualizado
7. **Backup**: Backup regular de datos
8. **Updates**: Dependencias actualizadas

## 📚 Referencias

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Configuration](https://nginx.org/en/docs/)
- [Prometheus Monitoring](https://prometheus.io/docs/)
- [Grafana Dashboards](https://grafana.com/docs/)
