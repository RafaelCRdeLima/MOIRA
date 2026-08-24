/** Resolve `var(--x)` no valor concreto que a tela está usando.
 *
 *  Fica separado do exportador de propósito: o exportador é função pura e
 *  testável, e é aqui que mora a única linha que precisa do navegador. Como lê
 *  do documento, o arquivo exportado sai no tema que estiver na tela — claro ou
 *  escuro — sem que o exportador saiba que temas existem. */

export function cssColorResolver(root: Element | null = null): (valor: string) => string {
  const alvo = root ?? document.documentElement;
  const estilo = getComputedStyle(alvo);
  const cache = new Map<string, string>();

  // Sonda: atribuir a cor a um elemento e ler de volta faz o navegador resolver
  // o que ainda não é cor concreta. Os tokens derivados são `color-mix(...)`, e
  // um renderizador antigo — o librsvg do Inkscape, por exemplo — não entende
  // `color-mix`. Sai `rgb(...)`, que todo mundo entende.
  const sonda = document.createElement('span');
  sonda.style.display = 'none';
  document.body.appendChild(sonda);

  const concreta = (valor: string): string => {
    try {
      sonda.style.color = '';
      sonda.style.color = valor;
      const lido = getComputedStyle(sonda).color;
      return lido && lido !== 'rgba(0, 0, 0, 0)' ? lido : valor;
    } catch {
      return valor;
    }
  };

  const resolver = (valor: string): string => {
    const guardado = cache.get(valor);
    if (guardado !== undefined) return guardado;

    const nome = /^var\((--[^)]+)\)$/.exec(valor.trim())?.[1];
    const substituido = nome ? estilo.getPropertyValue(nome).trim() || valor : valor;
    const resolvido = concreta(substituido);
    cache.set(valor, resolvido);
    return resolvido;
  };

  return resolver;
}

/** Salva um texto como arquivo. Um `blob:` e um clique — não há servidor para
 *  onde mandar, e nem deveria haver. */
export function saveText(nome: string, conteudo: string, tipo: string): void {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Nome de arquivo a partir do título do projeto, ou um padrão. */
export function fileName(titulo: string, extensao: string): string {
  const base = titulo
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'rede-tensorial'}.${extensao}`;
}
