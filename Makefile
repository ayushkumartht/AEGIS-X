.PHONY: dev test lint fmt clean

dev:
	powershell -File scripts/dev.ps1

test:
	cd backend && pytest -q

lint:
	ruff check backend/
	cd frontend && npx tsc --noEmit

fmt:
	ruff format backend/

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
