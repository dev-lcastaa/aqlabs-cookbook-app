import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.database import get_db
from models.schemas import CookbookCreate, CookbookDetail, CookbookRead, CookbookUpdate
from service import cookbook_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cookbooks", tags=["cookbooks"])


@router.post("", response_model=CookbookRead, status_code=status.HTTP_201_CREATED)
def create_cookbook(payload: CookbookCreate, db: Session = Depends(get_db)):
    logger.info("create_cookbook name=%r ethnicity=%r", payload.name, payload.ethnicity)
    result = cookbook_service.create_cookbook(db, payload)
    logger.info("create_cookbook ok cookbook_id=%d", result.id)
    return result


@router.get("", response_model=list[CookbookRead])
def list_cookbooks(db: Session = Depends(get_db)):
    return cookbook_service.list_cookbooks(db)


@router.get("/{cookbook_id}", response_model=CookbookDetail)
def get_cookbook(cookbook_id: int, db: Session = Depends(get_db)):
    cookbook = cookbook_service.get_cookbook_by_id(db, cookbook_id)
    if cookbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cookbook not found")
    return cookbook


@router.patch("/{cookbook_id}", response_model=CookbookRead)
def update_cookbook(cookbook_id: int, payload: CookbookUpdate, db: Session = Depends(get_db)):
    cookbook = cookbook_service.get_cookbook_by_id(db, cookbook_id)
    if cookbook is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cookbook not found")
    return cookbook_service.update_cookbook(db, cookbook, payload)


@router.delete("/{cookbook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cookbook(cookbook_id: int, db: Session = Depends(get_db)):
    cookbook = cookbook_service.get_cookbook_by_id(db, cookbook_id)
    if cookbook is None:
        logger.warning("delete_cookbook — cookbook %d not found", cookbook_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cookbook not found")
    logger.info("delete_cookbook cookbook_id=%d", cookbook_id)
    cookbook_service.delete_cookbook(db, cookbook)
