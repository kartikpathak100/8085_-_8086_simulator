IMAGE ?= mpu-workstation:1.0.0
PORT  ?= 8085

.PHONY: up down build run dev logs clean

up:      ## build and start the container
	docker compose up -d --build

down:
	docker compose down

build:
	docker build -t $(IMAGE) .

run: build
	docker run --rm -d -p $(PORT):80 --name mpu-workstation $(IMAGE)

logs:
	docker logs -f mpu-workstation

dev:
	npm install && npm run dev

clean:
	docker rmi $(IMAGE) 2>/dev/null || true
	rm -rf node_modules dist
