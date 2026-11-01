from typing import Any
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from app.db.models import RoleEnum


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    department: RoleEnum

    @model_validator(mode="before")
    @classmethod
    def normalize_input_keys(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Support camelCase fullName or simple name
            if "fullName" in data and "full_name" not in data:
                data["full_name"] = data["fullName"]
            elif "name" in data and "full_name" not in data:
                data["full_name"] = data["name"]
            # Support role alias for department
            if "role" in data and "department" not in data:
                data["department"] = data["role"]
        return data

    @field_validator("department", mode="before")
    @classmethod
    def normalize_department(cls, v: Any) -> Any:
        if isinstance(v, str):
            clean = v.strip().lower()
            if clean in ("human resources", "human_resources", "hr"):
                return RoleEnum.hr
            if clean in ("engineering", "eng"):
                return RoleEnum.engineering
            if clean in ("finance", "fin"):
                return RoleEnum.finance
            if clean == "admin":
                return RoleEnum.admin
            if clean == "demo_admin":
                return RoleEnum.demo_admin
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    role: RoleEnum
    full_name: str | None = None
    is_active: bool = True


class SignupResponse(BaseModel):
    message: str
    user: UserResponse
