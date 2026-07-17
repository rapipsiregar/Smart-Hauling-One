import time
from collections import defaultdict
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class AdminRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.request_history = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/admin"):
            client_ip = request.client.host if request.client else "unknown"
            now = time.time()
            
            # Prune requests older than 60 seconds
            self.request_history[client_ip] = [ts for ts in self.request_history[client_ip] if now - ts < 60]
            
            if len(self.request_history[client_ip]) >= 10:
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Rate limit exceeded. Maximum 10 requests per minute allowed on admin endpoints."}
                )
            
            self.request_history[client_ip].append(now)
            
        return await call_next(request)
