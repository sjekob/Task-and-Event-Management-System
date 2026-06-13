from fastapi import APIRouter, Depends
from database import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
def get_notifications(
    unread_only: bool = False,
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    uid = int(user["sub"])
    if unread_only:
        rows = db.execute(
            """SELECT * FROM notifications
               WHERE user_id=? AND is_read=0
               ORDER BY created_at DESC""",
            (uid,),
        ).fetchall()
    else:
        rows = db.execute(
            """SELECT * FROM notifications
               WHERE user_id=?
               ORDER BY created_at DESC
               LIMIT 50""",
            (uid,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/unread-count")
def get_unread_count(db=Depends(get_db), user=Depends(get_current_user)):
    uid = int(user["sub"])
    count = db.execute(
        "SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0",
        (uid,),
    ).fetchone()["c"]
    return {"count": count}


@router.post("/{notif_id}/read")
def mark_notification_read(
    notif_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    uid = int(user["sub"])
    db.execute(
        "UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?",
        (notif_id, uid),
    )
    db.commit()
    return {"message": "Marked as read"}


@router.post("/read-all")
def mark_all_notifications_read(db=Depends(get_db), user=Depends(get_current_user)):
    uid = int(user["sub"])
    db.execute(
        "UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0",
        (uid,),
    )
    db.commit()
    return {"message": "All notifications marked as read"}


@router.delete("/{notif_id}")
def delete_notification(
    notif_id: int,
    db=Depends(get_db),
    user=Depends(get_current_user),
):
    uid = int(user["sub"])
    db.execute(
        "DELETE FROM notifications WHERE id=? AND user_id=?",
        (notif_id, uid),
    )
    db.commit()
    return {"message": "Notification deleted"}
