from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.database import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    cookbook_id: Mapped[int] = mapped_column(
        ForeignKey("cookbooks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipe_name: Mapped[str] = mapped_column(String(200), nullable=False)
    ethnicity: Mapped[str] = mapped_column(String(120), nullable=False)
    ingredients: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    directions: Mapped[str] = mapped_column(Text, nullable=False)

    cookbook = relationship("Cookbook", back_populates="recipes")
