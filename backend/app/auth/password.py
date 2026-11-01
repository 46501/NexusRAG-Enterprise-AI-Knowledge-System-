from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

_pwd = PasswordHash([BcryptHasher()])


def hash_password(plain: str) -> str:
    return _pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd.verify(plain, hashed)
