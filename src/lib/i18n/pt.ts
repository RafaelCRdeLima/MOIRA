/** Português. As chaves são planas de propósito: no M1 entram en/fr/it como
 *  dicionários irmãos e o seletor de idioma troca o objeto inteiro. */
export const pt = {
  'app.title': 'MOIRA',
  'app.tagline': 'editor de redes tensoriais em notação de Penrose',

  'tool.addTensor': 'Adicionar tensor',
  'tool.delete': 'Apagar seleção',

  'canvas.label': 'Canvas da rede tensorial',
  'canvas.empty': 'Comece por uma MPS',
  'canvas.emptyHint': 'Os geradores de rede chegam no M1. Por ora, adicione tensores e ligue as pernas.',

  'status.tensors': 'tensores',
  'status.bonds': 'vínculos',
  'status.free': 'pernas livres',

  'hint.title': 'Como usar',
  'hint.add': 'Duplo clique no fundo adiciona um tensor.',
  'hint.drag': 'Arraste um tensor para movê-lo; arraste o fundo para deslocar a vista.',
  'hint.bond': 'Clique na ponta de uma perna livre e depois noutra para criar o vínculo.',
  'hint.unbond': 'Clique num vínculo para desfazê-lo.',
  'hint.delete': 'Delete apaga o que estiver selecionado.',
  'hint.keys': 'Tab percorre os tensores; as setas movem a seleção.',

  'bond.pending': 'Vínculo pendente. Escolha a outra ponta, ou Esc para desistir.',
} as const;

export type StringKey = keyof typeof pt;

export function t(key: StringKey): string {
  return pt[key];
}
