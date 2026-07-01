from pydantic import BaseModel, Field


class UpdateQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
