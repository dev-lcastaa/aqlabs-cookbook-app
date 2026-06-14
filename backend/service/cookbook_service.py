from sqlalchemy.orm import Session

from models.cookbook import Cookbook
from models.schemas import CookbookCreate, CookbookUpdate


def create_cookbook(db: Session, payload: CookbookCreate) -> Cookbook:
    cookbook = Cookbook(name=payload.name, ethnicity=payload.ethnicity)
    db.add(cookbook)
    db.commit()
    db.refresh(cookbook)
    return cookbook


def list_cookbooks(db: Session) -> list[Cookbook]:
    return db.query(Cookbook).order_by(Cookbook.created_at.desc()).all()


def get_cookbook_by_id(db: Session, cookbook_id: int) -> Cookbook | None:
    return db.query(Cookbook).filter(Cookbook.id == cookbook_id).first()


def update_cookbook(db: Session, cookbook: Cookbook, payload: CookbookUpdate) -> Cookbook:
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(cookbook, key, value)
    db.add(cookbook)
    db.commit()
    db.refresh(cookbook)
    return cookbook


def delete_cookbook(db: Session, cookbook: Cookbook) -> None:
    db.delete(cookbook)
    db.commit()
