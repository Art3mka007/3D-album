import zenitCover from '../assets/images/cover_zenit_1794599765747.jpg';
import sneakersCover from '../assets/images/cover_sneakers_1794599765164.jpg';
import avocadoCover from '../assets/images/cover_avocado_1794599765579.jpg';

const DEMO_COVER_MAP: Record<string, string> = {
  'demo:zenit': zenitCover,
  'demo:sneakers': sneakersCover,
  'demo:avocado': avocadoCover,
};

export function resolveCoverUrl(coverUrl: string): string {
  return DEMO_COVER_MAP[coverUrl] ?? coverUrl;
}
