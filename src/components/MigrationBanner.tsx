import { motion } from 'framer-motion';
import { CloudUpload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCloudRepo } from '../context/DataContext';
import {
  countLocalTransactions,
  dismissMigration,
  migrateLocalToCloud,
  migrationPending,
} from '../data/migration';

/**
 * À la première connexion, propose de rapatrier les données créées
 * en mode hors-ligne sur cet appareil vers le compte.
 */
export function MigrationBanner() {
  const { user } = useAuth();
  const cloudRepo = useCloudRepo();
  const [localCount, setLocalCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState('');

  const uid = user?.uid;

  useEffect(() => {
    if (!uid || !cloudRepo || !migrationPending(uid)) return;
    void countLocalTransactions().then(setLocalCount);
  }, [uid, cloudRepo]);

  if (!uid || !cloudRepo || localCount === 0) return null;

  async function run() {
    if (!cloudRepo || !uid) return;
    setBusy(true);
    setError('');
    try {
      setDone(await migrateLocalToCloud(cloudRepo, uid));
    } catch {
      setError("L'import a échoué. Réessaie ou utilise Réglages → Importer un fichier.");
    } finally {
      setBusy(false);
    }
  }

  function skip() {
    if (uid) dismissMigration(uid);
    setLocalCount(0);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 p-4"
    >
      <CloudUpload size={18} className="shrink-0 text-accent-2" />
      <p className="min-w-[12rem] flex-1 text-sm text-ink-2">
        {done !== null ? (
          <>
            <span className="font-semibold text-pos">{done} transaction(s) importée(s)</span> dans
            ton compte.
          </>
        ) : (
          <>
            Cet appareil contient{' '}
            <span className="font-semibold text-ink">{localCount} transaction(s)</span> créées hors
            connexion. Les rapatrier dans ton compte ?
          </>
        )}
      </p>

      {done === null ? (
        <div className="flex items-center gap-2">
          <button
            onClick={run}
            disabled={busy}
            className="bg-gradient-flow min-h-[40px] cursor-pointer rounded-2xl px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Import…' : 'Importer'}
          </button>
          <button
            onClick={skip}
            aria-label="Ignorer"
            className="cursor-pointer p-2 text-ink-3 hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setLocalCount(0)}
          className="cursor-pointer p-2 text-ink-3 hover:text-ink"
          aria-label="Fermer"
        >
          <X size={16} />
        </button>
      )}

      {error && (
        <p role="alert" className="w-full text-xs text-neg">
          {error}
        </p>
      )}
    </motion.div>
  );
}
