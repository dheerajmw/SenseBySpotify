import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import get_settings
from app.exceptions import (
    AppError,
    app_error_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.logging_config import setup_logging
from app.routers import health, recommendations, search, session

setup_logging()
logger = logging.getLogger(__name__)

settings = get_settings()

app = FastAPI(
    title="Sense",
    description="AI-powered music discovery API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.include_router(health.router)
app.include_router(search.router)
app.include_router(recommendations.router)
app.include_router(session.router)


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("Starting Sense API in %s mode", settings.environment)
