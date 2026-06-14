from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.database import Base


class Cookbook(Base):
    __tablename__ = "cookbooks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    ethnicity: Mapped[str] = mapped_column(String(120), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    recipes = relationship(
        "Recipe",
        back_populates="cookbook",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
