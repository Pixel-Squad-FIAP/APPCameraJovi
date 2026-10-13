import { useState } from 'react';
import { useAlbums } from '../../hooks/usePreference.js';
import Button from '../ui/Button.jsx';
import Chip from '../ui/Chip.jsx';

// Escolha de álbum (matéria) com criação de álbum novo no mesmo lugar.
export default function AlbumPicker({ onSelect, selected }) {
  const { albums, addAlbum } = useAlbums();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleCreate = (event) => {
    event.preventDefault();
    const result = addAlbum(name);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSelect(result.name);
    setName('');
    setError('');
    setCreating(false);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Álbuns">
        {albums.map((album) => (
          <Chip active={album === selected} icon={album === selected ? 'check' : undefined} key={album} onClick={() => onSelect(album)}>
            {album}
          </Chip>
        ))}
        {!creating && <Chip icon="plus" onClick={() => setCreating(true)}>Novo álbum</Chip>}
      </div>

      {creating && (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={handleCreate}>
          <label className="sr-only" htmlFor="new-album-name">Nome do novo álbum</label>
          <input
            aria-describedby={error ? 'new-album-error' : undefined}
            aria-invalid={Boolean(error)}
            autoFocus
            className="min-h-11 flex-1 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-jovi-400"
            id="new-album-name"
            maxLength={30}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
            placeholder="Ex.: Física, Cálculo II…"
            value={name}
          />
          <div className="flex gap-2">
            <Button className="flex-1" type="submit">Criar</Button>
            <Button className="flex-1" onClick={() => { setCreating(false); setError(''); setName(''); }} variant="secondary">Cancelar</Button>
          </div>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-300" id="new-album-error" role="alert">{error}</p>}
    </div>
  );
}
