# FitManager360 Makefile

.PHONY: help build dev prod clean logs test deploy

# Colors for output
YELLOW := \033[1;33m
GREEN := \033[1;32m
RED := \033[1;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(YELLOW)FitManager360 - Available Commands:$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

build: ## Build all Docker images locally
	@echo "$(YELLOW)Building all Docker images...$(NC)"
	docker-compose build --no-cache

dev: ## Start development environment
	@echo "$(YELLOW)Starting development environment...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Development environment started!$(NC)"
	@echo "Frontend: http://localhost:8081"
	@echo "API Gateway: http://localhost:8080"
	@echo "Grafana: http://localhost:3005"

prod: ## Start production environment
	@echo "$(YELLOW)Starting production environment...$(NC)"
	docker-compose -f docker-compose.prod.yml up -d
	@echo "$(GREEN)Production environment started!$(NC)"

stop: ## Stop all services
	@echo "$(YELLOW)Stopping all services...$(NC)"
	docker-compose down
	docker-compose -f docker-compose.prod.yml down

clean: ## Clean up Docker resources
	@echo "$(YELLOW)Cleaning up Docker resources...$(NC)"
	docker-compose down --volumes --remove-orphans
	docker system prune -af

logs: ## Show logs for all services
	docker-compose logs -f

logs-prod: ## Show logs for production services
	docker-compose -f docker-compose.prod.yml logs -f

logs-service: ## Show logs for specific service (usage: make logs-service SERVICE=auth-service)
	@if [ -z "$(SERVICE)" ]; then echo "$(RED)Please specify SERVICE variable$(NC)"; exit 1; fi
	docker-compose logs -f $(SERVICE)

test: ## Run tests for all services
	@echo "$(YELLOW)Running tests...$(NC)"
	@for service in auth-service routine-service chat-service stats-service api-gateway; do \
		echo "Testing $$service..."; \
		docker-compose exec $$service npm test || true; \
	done
	@echo "$(YELLOW)Testing frontend...$(NC)"
	docker-compose exec frontend npm test -- --coverage --watchAll=false || true

health: ## Check health of all services
	@echo "$(YELLOW)Checking service health...$(NC)"
	@echo "API Gateway: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health || echo "DOWN")"
	@echo "Auth Service: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || echo "DOWN")"
	@echo "Routine Service: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/health || echo "DOWN")"
	@echo "Chat Service: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/health || echo "DOWN")"
	@echo "Stats Service: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/health || echo "DOWN")"
	@echo "Frontend: $$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081 || echo "DOWN")"

deploy: ## Deploy to production server
	@echo "$(YELLOW)Deploying to production...$(NC)"
	./scripts/deploy.sh

setup-server: ## Setup production server
	@echo "$(YELLOW)Setting up production server...$(NC)"
	./scripts/setup-server.sh

backup: ## Backup MongoDB data
	@echo "$(YELLOW)Creating MongoDB backup...$(NC)"
	mkdir -p backups
	docker exec fitmanager_mongodb_auth mongodump --uri="mongodb://admin:password123@localhost:27017/fitmanager_auth?authSource=admin" --out=/tmp/backup
	docker cp fitmanager_mongodb_auth:/tmp/backup ./backups/auth-$(shell date +%Y%m%d_%H%M%S)
	@echo "$(GREEN)Backup completed in ./backups/$(NC)"

restore: ## Restore MongoDB data (usage: make restore BACKUP_PATH=./backups/auth-20250101_120000)
	@if [ -z "$(BACKUP_PATH)" ]; then echo "$(RED)Please specify BACKUP_PATH variable$(NC)"; exit 1; fi
	@echo "$(YELLOW)Restoring MongoDB backup...$(NC)"
	docker cp $(BACKUP_PATH) fitmanager_mongodb_auth:/tmp/restore
	docker exec fitmanager_mongodb_auth mongorestore --uri="mongodb://admin:password123@localhost:27017/fitmanager_auth?authSource=admin" /tmp/restore

monitor: ## Open monitoring dashboard
	@echo "$(GREEN)Opening monitoring dashboard...$(NC)"
	@echo "Grafana: http://localhost:3005 (admin/admin123)"
	@echo "Prometheus: http://localhost:9090"

scale: ## Scale services (usage: make scale SERVICE=auth-service REPLICAS=3)
	@if [ -z "$(SERVICE)" ] || [ -z "$(REPLICAS)" ]; then echo "$(RED)Please specify SERVICE and REPLICAS variables$(NC)"; exit 1; fi
	docker-compose up -d --scale $(SERVICE)=$(REPLICAS)

install-hooks: ## Install Git hooks
	@echo "$(YELLOW)Installing Git hooks...$(NC)"
	cp scripts/pre-commit .git/hooks/pre-commit
	chmod +x .git/hooks/pre-commit
	@echo "$(GREEN)Git hooks installed!$(NC)"
