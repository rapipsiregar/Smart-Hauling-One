# Integrated Smart Hauling System -- one-command development.
#
# `make up` is the whole thing: build, start all four services, seed the master.

.DEFAULT_GOAL := help
COMPOSE := docker compose

# Ports, in one place. `?=` keeps any value already in the environment, so
# `CORE_API_PORT=8001 make dev` still works; `export` passes them on to
# docker compose, which reads the same names.
CORE_API_PORT ?= 8000
EDGE_API_PORT ?= 8100
CORE_UI_PORT  ?= 3000
EDGE_UI_PORT  ?= 3100
export CORE_API_PORT EDGE_API_PORT CORE_UI_PORT EDGE_UI_PORT

CORE_API_ORIGIN := http://127.0.0.1:$(CORE_API_PORT)
EDGE_API_ORIGIN := http://127.0.0.1:$(EDGE_API_PORT)

help:  ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | \
	 awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up:  ## Build and start everything, then seed the truck master
	$(COMPOSE) up -d --build
	@echo "waiting for the core API..."
	@for i in $$(seq 1 60); do \
	  curl -sf http://localhost:$(CORE_API_PORT)/ >/dev/null && break || sleep 2; \
	done
	@$(MAKE) --no-print-directory seed
	@$(MAKE) --no-print-directory urls

down:  ## Stop everything
	$(COMPOSE) down

logs:  ## Tail all logs
	$(COMPOSE) logs -f

ps:  ## Show service status
	$(COMPOSE) ps

seed:  ## Import the truck master into the core
	@$(COMPOSE) exec -T core-backend python -m app.services.master_import --replace \
	  || echo "  (skipped: put the operator spreadsheet in core/backend/sources/)"

demo:  ## Add demo crossings so the dashboard is not empty
	@$(COMPOSE) exec -T core-backend python -m app.demo_data

provision:  ## Issue an edge API key: make provision GATE=CAM-GATE-A
	@$(COMPOSE) exec -T core-backend python main.py provision-device $(or $(GATE),CAM-GATE-A) --rotate

# --- Local (no Docker) -------------------------------------------------------
# The Docker path needs registry access. Where that is unavailable -- or when you
# want the real detection stack, which the dev images deliberately omit -- this
# runs the same four services straight from the working tree.

# A port already in use by something else is worse than a crash: the UI proxies
# to the stranger and shows its 404s as if they were ours. Fail loudly instead.
#
# The test is "did anything accept the connection", NOT "did it return 2xx".
# curl exit 7 is the only "nothing is listening" answer; a 404, a 500 or a hang
# all mean the port is taken. This checked for 2xx once, and sailed straight past
# the unrelated container on :8000 that returns 404 -- the exact case it exists
# to catch.
check-ports:  ## Verify the four dev ports are free
	@for p in $(CORE_API_PORT) $(EDGE_API_PORT) $(CORE_UI_PORT) $(EDGE_UI_PORT); do \
	  curl -s -o /dev/null --max-time 2 http://127.0.0.1:$$p/ 2>/dev/null; \
	  if [ $$? -ne 7 ]; then \
	    echo "  ERROR: port $$p already answers -- something else is running there."; \
	    echo "         Stop it, or override e.g. CORE_API_PORT=8001 make dev"; \
	    exit 1; \
	  fi; \
	done
	@echo "  ports free"

# Next.js resolves rewrites at BUILD time and bakes them into
# .next/routes-manifest.json, so pointing a UI at a different API port needs a
# rebuild -- setting the env var on `next start` does nothing. Overriding a port
# without rebuilding leaves the UI proxying to whatever now sits on the old one,
# which is the same silent-wrong-backend failure check-ports guards against.
check-ui:  ## Verify each built UI proxies to the API port we are about to start
	@ok=1; \
	for pair in "core/frontend|$(CORE_API_ORIGIN)" "edge/frontend|$(EDGE_API_ORIGIN)"; do \
	  dir=$${pair%%|*}; origin=$${pair##*|}; \
	  manifest="$$dir/.next/routes-manifest.json"; \
	  if [ ! -f "$$manifest" ]; then \
	    echo "  ERROR: $$dir is not built. Run: make build-ui"; ok=0; \
	  elif ! grep -q "$$origin/api" "$$manifest"; then \
	    echo "  ERROR: $$dir was built for a different API origin than $$origin."; \
	    echo "         Rebuild with the ports you are using: make build-ui"; ok=0; \
	  fi; \
	done; \
	[ $$ok -eq 1 ] || exit 1
	@echo "  UIs point at the right backends"

# Each service is started with `setsid sh -c 'echo $$ > pid; exec ...'`, so the
# recorded pid is also the process-group id and dev-stop can signal the whole
# tree. `npx next start` is three processes deep -- npx, sh, next-server -- and
# killing only the pid the shell reported left next-server holding the port
# after every `make dev-stop`. Those orphans are then indistinguishable from a
# genuine port conflict, which is what check-ports would go on to report.
define start_service
	@cd $(1) && setsid sh -c 'echo $$$$ > $(2); exec $(3)' > $(4) 2>&1 &
endef

dev: check-ports check-ui  ## Start all four services locally, without Docker
	@mkdir -p .run
	$(call start_service,core/backend,../../.run/core-backend.pid,\
	  .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 \
	  --port $(CORE_API_PORT) --log-level warning,../../.run/core-backend.log)
	$(call start_service,edge/backend,../../.run/edge-backend.pid,\
	  env SMART_GATE_RUN_AGENT=$${EDGE_RUN_AGENT:-false} \
	  SMART_GATE_CAMERA_CODE=$${EDGE_CAMERA_CODE:-CAM-GATE-A} \
	  SMART_GATE_INDUK_URL=$(CORE_API_ORIGIN) \
	  SMART_GATE_EDGE_DB=./data/edge.db PYTHONPATH=. \
	  ../../core/backend/.venv/bin/python -m uvicorn app.main:app \
	  --host 127.0.0.1 --port $(EDGE_API_PORT) --log-level warning,\
	  ../../.run/edge-backend.log)
	$(call start_service,core/frontend,../../.run/core-frontend.pid,\
	  npx next start -p $(CORE_UI_PORT),../../.run/core-frontend.log)
	$(call start_service,edge/frontend,../../.run/edge-frontend.pid,\
	  npx next start -p $(EDGE_UI_PORT),../../.run/edge-frontend.log)
	@sleep 8
	@$(MAKE) --no-print-directory urls

# --- the demo: centre in Docker, gates on the host for the GPU ----------------
# Detection needs CUDA, and a container without device passthrough falls back to
# a CPU that cannot keep up -- which reads as a broken pipeline rather than a
# missing flag. scripts/demo.sh keeps the two halves in step.

demo-up:  ## Start the centre + gates A and B (GATES="a b c d" for more)
	@./scripts/demo.sh up

demo-down:  ## Stop the centre and every gate
	@./scripts/demo.sh down

demo-restart:  ## Restart everything -- use this after editing code
	@./scripts/demo.sh restart

demo-status:  ## Show what is running and which device each console talks to
	@./scripts/demo.sh status

demo-build:  ## Rebuild the gate UIs (one output per gate, see scripts/demo.sh)
	@./scripts/demo.sh build

dev-stop:  ## Stop the local (non-Docker) services
	@for f in .run/*.pid; do \
	  [ -f "$$f" ] || continue; \
	  pid=$$(cat $$f); \
	  kill -- -$$pid 2>/dev/null || kill $$pid 2>/dev/null || true; \
	done
	@sleep 1
	@rm -rf .run
	@echo "stopped"

build-ui:  ## Build both frontends (needed once before `make dev`)
	cd core/frontend && npm install --no-audit --no-fund && \
	  BACKEND_ORIGIN=$(CORE_API_ORIGIN) npx next build
	cd edge/frontend && npm install --no-audit --no-fund && \
	  EDGE_BACKEND_ORIGIN=$(EDGE_API_ORIGIN) npx next build

test:  ## Run both test suites
	cd core/backend && .venv/bin/python -m pytest tests/ -q --ignore=tests/test_e2e_playwright.py
	cd edge/backend && PYTHONPATH=. ../../core/backend/.venv/bin/python -m pytest tests/ -q

urls:  ## Print where everything is
	@echo ""
	@echo "  Core dashboard   http://localhost:$(CORE_UI_PORT)"
	@echo "  Core API         http://localhost:$(CORE_API_PORT)/docs"
	@echo "  Gate UI          http://localhost:$(EDGE_UI_PORT)"
	@echo "  Gate API         http://localhost:$(EDGE_API_PORT)/docs"
	@echo ""

.PHONY: help up down logs ps seed demo provision test urls dev dev-stop build-ui \
	demo-up demo-down demo-restart demo-status demo-build \
        check-ports check-ui
