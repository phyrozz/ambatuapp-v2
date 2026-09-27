'use client';

import Link from 'next/link';
import { ArrowBigDown, ArrowBigUp, Reply, Send } from 'lucide-react';
import { useI18n } from './i18n-provider';

export type ThreadComment = {
  id: string;
  text: string;
  author: string;
  authorId?: string | null;
  avatarUrl?: string | null;
  parentId?: string | null;
  upvotes?: number;
  downvotes?: number;
  userVote?: number;
};

type Props = {
  comments: ThreadComment[];
  currentUserId?: string;
  replyingTo: string | null;
  replyText: string;
  onVote: (commentId: string, value: 1 | -1) => void;
  onReplyStart: (commentId: string) => void;
  onReplyTextChange: (value: string) => void;
  onReplyCancel: () => void;
  onReplySubmit: (commentId: string) => void;
};

export function CommentThreadList({ comments, currentUserId, replyingTo, replyText, onVote, onReplyStart, onReplyTextChange, onReplyCancel, onReplySubmit }: Props) {
  const { t } = useI18n();
  const byId = new Map(comments.map(comment => [comment.id, comment]));
  const children = new Map<string, ThreadComment[]>();
  for (const comment of comments) {
    if (!comment.parentId || !byId.has(comment.parentId)) continue;
    const siblings = children.get(comment.parentId) ?? [];
    siblings.push(comment);
    children.set(comment.parentId, siblings);
  }
  const roots = comments.filter(comment => !comment.parentId || !byId.has(comment.parentId));

  function renderComment(comment: ThreadComment, depth = 0) {
    const depthClass = `comment-thread-depth-${Math.min(depth, 4)}`;
    const upvotes = comment.upvotes ?? 0;
    const downvotes = comment.downvotes ?? 0;
    return <article className={`comment-thread-item ${depthClass}`} key={comment.id}>
      <div className="comment-thread-author">
        {comment.avatarUrl && <img className="profile-avatar-inline" src={comment.avatarUrl} alt="" />}
        {!comment.avatarUrl && <span className="comment-avatar-fallback" aria-hidden="true">{comment.author.trim().slice(0, 1).toUpperCase()}</span>}
        <b>{comment.authorId && comment.authorId !== currentUserId
          ? <Link href={`/chat/?user=${encodeURIComponent(comment.authorId)}&name=${encodeURIComponent(comment.author)}`} aria-label={t('chat.messageUser', { name: comment.author })}>{comment.author}</Link>
          : comment.author}</b>
      </div>
      <p className="comment-thread-body">{comment.text}</p>
      <div className="comment-thread-actions">
        <button className={`comment-vote-button comment-vote-up${comment.userVote === 1 ? ' selected' : ''}`} type="button" aria-label={`${t('lore.upvote')}: ${upvotes}`} aria-pressed={comment.userVote === 1} onClick={() => onVote(comment.id, 1)}><ArrowBigUp size={16}/><span>{upvotes}</span></button>
        <button className={`comment-vote-button comment-vote-down${comment.userVote === -1 ? ' selected' : ''}`} type="button" aria-label={`${t('lore.downvote')}: ${downvotes}`} aria-pressed={comment.userVote === -1} onClick={() => onVote(comment.id, -1)}><ArrowBigDown size={16}/><span>{downvotes}</span></button>
        <button className="comment-reply-button" type="button" onClick={() => onReplyStart(comment.id)}><Reply size={15}/><span>{t('comments.reply')}</span></button>
      </div>
      {replyingTo === comment.id && <form className="comment-reply-form" onSubmit={event => { event.preventDefault(); onReplySubmit(comment.id); }}>
        <textarea value={replyText} maxLength={1000} placeholder={t('comments.replyPlaceholder')} aria-label={t('comments.replyPlaceholder')} onChange={event => onReplyTextChange(event.target.value)} />
        <div className="comment-reply-form-actions">
          <button className="comment-cancel-reply" type="button" onClick={onReplyCancel}>{t('comments.cancelReply')}</button>
          <button className="comment-send-reply" type="submit" aria-label={t('watch.postComment')} disabled={!replyText.trim()}><Send size={16}/></button>
        </div>
      </form>}
      {children.get(comment.id)?.length ? <div className="comment-thread-children">{children.get(comment.id)!.map(child => renderComment(child, depth + 1))}</div> : null}
    </article>;
  }

  return <div className="comment-thread-list">{roots.map(comment => renderComment(comment))}</div>;
}
