"""Integrated Smart Hauling System backend — FastAPI application for the hauling-truck reader.

Layered architecture:

    routers/       thin HTTP layer (request/response only, no logic)
    services/      business logic and data shaping
    repositories/  all persistence access (SQLite + JSON files)
    schemas/       Pydantic request/response models
    core/          configuration and database connections
    utils/         cross-cutting helpers (media transcoding, path math)
"""
