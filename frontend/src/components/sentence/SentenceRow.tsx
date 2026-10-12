import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import type { Sentence } from '../../types';
import { CategoryBadge, FavoriteButton, MasteryBadge } from '../ui/Badges';
import { SpeakButton } from './SpeakButton';

export function SentenceRow({
  sentence,
  onChanged,
  onEdit,
  onDelete,
  deleteLabel = '删除',
}: {
  sentence: Sentence;
  onChanged: (s: Sentence) => void;
  onEdit?: (s: Sentence) => void;
  onDelete?: (s: Sentence) => void;
  deleteLabel?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }
    const { favorite } = await api.favorites.toggle(sentence.id);
    onChanged({ ...sentence, favorite });
  };

  return (
    <div className="group flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <FavoriteButton favorite={sentence.favorite} onToggle={toggleFavorite} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium leading-6 text-slate-800 dark:text-slate-100">{sentence.english}</p>
            {sentence.pronunciation && (
              <p className="mt-0.5 text-xs italic text-slate-400 dark:text-slate-500">{sentence.pronunciation}</p>
            )}
          </div>
          <SpeakButton text={sentence.english} className="mt-0.5" />
        </div>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{sentence.chinese}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <CategoryBadge sentence={sentence} />
          <span className="text-xs text-slate-400">难度 {'★'.repeat(sentence.difficulty)}{'☆'.repeat(5 - sentence.difficulty)}</span>
          <MasteryBadge level={sentence.masteryLevel} />
          {sentence.wrongCount ? (
            <span className="text-xs text-rose-400">错 {sentence.wrongCount}</span>
          ) : null}
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button onClick={() => onEdit(sentence)} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
              编辑
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(sentence)} className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-950/40">
              {deleteLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
