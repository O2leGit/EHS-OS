from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost:5432/ehs_os"
    claude_api_key: str = ""
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    s3_endpoint: str = ""
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "ehs-os-documents"
    frontend_url: str = "http://localhost:3000"
    upload_dir: str = "./uploads"

    class Config:
        env_file = ".env"


settings = Settings()
