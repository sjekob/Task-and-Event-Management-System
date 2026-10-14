from fastapi import APIRouter, HTTPException, Depends, Request
import audit
from pydantic import BaseModel
from typing import Optional
from routes.tasks import require_task_access
from database import connect_db
from auth import get_current_user

router = APIRouter(tags=["Comments"])


class CommentRequest(BaseModel):
    content: str
    comment_type: str = "public"
    report_id: Optional[int] = None


@router.post("/api/tasks/{task_id}/comments")
def add_comment(task_id: int, req: CommentRequest, request: Request, user=Depends(get_current_user)):
    db = connect_db()
    uid = int(user["sub"])
    try:
        require_task_access(db, task_id, user)
    except HTTPException:
        db.close()
        raise
    if req.comment_type not in ("public", "private"):
        db.close()
        raise HTTPException(400, "comment_type must be 'public' or 'private'")
    if req.report_id is not None and not db.execute(
            "SELECT 1 FROM reports WHERE id=? AND task_id=?", (req.report_id, task_id)).fetchone():
        db.close()
        raise HTTPException(400, "That report does not belong to this task")
    db.execute(
        "INSERT INTO comments (task_id, user_id, report_id, comment_type, content) VALUES (?,?,?,?,?)",
        (task_id, uid, req.report_id, req.comment_type, req.content)
    )
    # The comment's text is not copied into the trail (private ones stay private).
    audit.record(db, user, "comment.add", "task", task_id,
                 f"Added a {req.comment_type} comment", request=request)
    db.commit()
    db.close()
    return {"message": "Comment added"}


class CommentUpdateRequest(BaseModel):
    content: str


@router.put("/api/comments/{comment_id}")
def edit_comment(comment_id: int, req: CommentUpdateRequest, request: Request,
                 user=Depends(get_current_user)):
    db = connect_db()
    uid = int(user["sub"])
    row = db.execute("SELECT user_id, task_id, comment_type FROM comments WHERE id=?",
                     (comment_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Comment not found")
    if row["user_id"] != uid:
        db.close()
        raise HTTPException(403, "Cannot edit another user's comment")
    db.execute("UPDATE comments SET content=? WHERE id=?", (req.content, comment_id))
    audit.record(db, user, "comment.edit", "task", row["task_id"],
                 f"Edited a {row['comment_type']} comment", request=request)
    db.commit()
    db.close()
    return {"message": "Comment updated"}


@router.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int, request: Request, user=Depends(get_current_user)):
    db = connect_db()
    uid = int(user["sub"])
    row = db.execute("SELECT user_id, task_id, comment_type FROM comments WHERE id=?",
                     (comment_id,)).fetchone()
    if not row:
        db.close()
        raise HTTPException(404, "Comment not found")
    if row["user_id"] != uid:
        db.close()
        raise HTTPException(403, "Cannot delete another user's comment")
    db.execute("DELETE FROM comments WHERE id=?", (comment_id,))
    audit.record(db, user, "comment.delete", "task", row["task_id"],
                 f"Deleted a {row['comment_type']} comment", request=request)
    db.commit()
    db.close()
    return {"message": "Comment deleted"}
