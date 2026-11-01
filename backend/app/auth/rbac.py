from app.db.models import RoleEnum

ROLE_PERMISSIONS: dict[RoleEnum, set[str]] = {
    RoleEnum.hr: {"hr"},
    RoleEnum.engineering: {"engineering"},
    RoleEnum.finance: {"finance"},
}


def get_allowed_collections(role: RoleEnum) -> list[str]:
    return list(ROLE_PERMISSIONS.get(role, set()))


def can_access(role: RoleEnum, collection: str) -> bool:
    return collection in ROLE_PERMISSIONS.get(role, set())
