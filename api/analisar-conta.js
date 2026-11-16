const crypto = require('node:crypto');

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    leitura: {
      type: 'object', additionalProperties: false,
      properties: {
        titular: { type: ['string', 'null'] }, valor_total: { type: ['number', 'null'] }, consumo_kwh: { type: ['number', 'null'] }, periodo: { type: ['string', 'null'] }, vencimento: { type: ['string', 'null'] }, tarifa_kwh: { type: ['number', 'null'] }, bandeira: { type: ['string', 'null'] }, tributos_encargos: { type: ['number', 'null'] }, iluminacao_publica: { type: ['number', 'null'] }, distribuidora: { type: ['string', 'null'] },
      },
      required: ['titular', 'valor_total', 'consumo_kwh', 'periodo', 'vencimento', 'tarifa_kwh', 'bandeira', 'tributos_encargos', 'iluminacao_publica', 'distribuidora'],
    },
    confianca: { type: 'number' }, observacoes: { type: 'array', items: { type: 'string' } }, explicacao: { type: 'string' },
    grupos_consumo: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { nome: { type: 'string' }, percentual: { type: 'number' }, margem: { type: 'number' }, justificativa: { type: 'string' } }, required: ['nome', 'percentual', 'margem', 'justificativa'] } },
    proposta: {
      type: 'object', additionalProperties: false,
      properties: {
        economia_mensal: { type: 'number' }, faixa_minima: { type: 'number' }, faixa_maxima: { type: 'number' }, meta_mensal: { type: 'number' },
        recomendacoes: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { titulo: { type: 'string' }, descricao: { type: 'string' }, economia_estimada: { type: 'number' }, custo_estimado: { type: 'number' }, retorno_meses: { type: ['number', 'null'] } }, required: ['titulo', 'descricao', 'economia_estimada', 'custo_estimado', 'retorno_meses'] } },
      },
      required: ['economia_mensal', 'faixa_minima', 'faixa_maxima', 'meta_mensal', 'recomendacoes'],
    },
  },
  required: ['leitura', 'confianca', 'observacoes', 'explicacao', 'grupos_consumo', 'proposta'],
};

const prompt = `Leia esta conta de energia brasileira com cuidado e responda em português do Brasil.

Regras:
- Extraia somente valores realmente visíveis. Quando não estiver legível ou não existir, use null.
- Extraia também o nome do titular/cliente da conta. Procure os rótulos NOME, CLIENTE, TITULAR, CONSUMIDOR, RESPONSÁVEL ou RAZÃO SOCIAL, inclusive no bloco da unidade consumidora. Para pessoa jurídica, use a razão social. Se não estiver claramente visível, use null.
- Nunca invente dados para preencher um campo.
- Diferencie valor da conta, consumo em kWh e tarifa por kWh.
- Tributos/encargos e iluminação pública devem ser valores em reais quando estiverem discriminados; use null caso contrário.
- Grupos de consumo são ESTIMATIVAS, não medições: use no máximo 5 grupos, totalizando aproximadamente 100%, com margem de erro realista.
- A proposta deve ser conservadora, baseada no consumo e no valor lidos. Não prometa economia garantida.
- A economia estimada deve ser 0 quando não houver consumo ou valor confiável.
- Explique incertezas e o que o usuário deve conferir.

Retorne o resultado seguindo exatamente o schema estruturado enviado pela aplicação.`;

function reply(res, status, body) { res.setHeader('Cache-Control', 'no-store, max-age=0'); return res.status(status).json(body); }
function tokenFor(taskId) { return `${taskId}.${crypto.createHmac('sha256', process.env.MANUS_API_KEY).update(taskId).digest('hex')}`; }
function taskFromToken(token) {
  const raw = String(token || '');
  if (/^[A-Za-z0-9]{22}$/.test(raw)) return raw;
  const [taskId, signature] = raw.split('.');
  if (!taskId || !signature || !process.env.MANUS_API_KEY) return null;
  const expected = crypto.createHmac('sha256', process.env.MANUS_API_KEY).update(taskId).digest('hex');
  if (signature.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? taskId : null;
}
async function manus(path, options = {}) {
  return fetch(`https://api.manus.ai/v2/${path}`, { ...options, headers: { 'x-manus-api-key': process.env.MANUS_API_KEY, 'Content-Type': 'application/json', ...(options.headers || {}) } });
}

async function readResult(req, res) {
  const url = new URL(req.url, 'https://enerlis.local');
  const queryJob = req.query?.job || req.query?.task_id || url.searchParams.get('job') || url.searchParams.get('task_id');
  const taskId = taskFromToken(Array.isArray(queryJob) ? queryJob[0] : queryJob);
  if (!taskId) return reply(res, 400, { error: 'Tarefa de análise inválida.' });
  const upstream = await manus(`task.listMessages?task_id=${encodeURIComponent(taskId)}&order=desc&limit=50`);
  const body = await upstream.json();
  if (!upstream.ok || body.ok === false) return reply(res, 502, { error: 'Não foi possível consultar o resultado da análise.' });
  const event = (body.messages || []).find(item => item.type === 'structured_output_result');
  if (!event) return reply(res, 202, { ok: true, pending: true });
  if (!event.structured_output_result?.success) return reply(res, 422, { error: event.structured_output_result?.error || 'A análise não produziu um resultado confiável.' });
  const data = event.structured_output_result.value;
  data.confianca = Math.max(0, Math.min(1, Number(data.confianca) || 0));
  return reply(res, 200, { ok: true, pending: false, data });
}

module.exports = async function handler(req, res) {
  if (!process.env.MANUS_API_KEY) return reply(res, 503, { error: 'A API do Manus ainda não foi configurada. Adicione MANUS_API_KEY nas variáveis da Vercel.' });
  if (req.method === 'GET') {
    try { return await readResult(req, res); } catch (error) { console.error('Manus polling error', error); return reply(res, 500, { error: 'Erro ao consultar a análise.' }); }
  }
  if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return reply(res, 405, { error: 'Método não permitido.' }); }

  const image = req.body && req.body.image;
  if (typeof image !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) return reply(res, 400, { error: 'Envie uma imagem JPG, PNG ou WEBP.' });
  if (image.length > 5_000_000) return reply(res, 413, { error: 'A imagem é muito grande. Reduza a foto para até 3 MB.' });

  try {
    const upstream = await manus('task.create', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Leitura de conta de energia — Enerlis', locale: 'pt-BR', agent_profile: 'lite', interactive_mode: false, hide_in_task_list: true,
        message: { content: [{ type: 'text', text: prompt }, { type: 'file', file_data: image, filename: 'conta-energia.jpg', mime_type: 'image/jpeg' }] },
        structured_output_schema: schema,
      }),
    });
    const body = await upstream.json();
    if (!upstream.ok || body.ok === false || !body.task_id) { console.error('Manus create error', upstream.status, body); return reply(res, 502, { error: 'O Manus não conseguiu iniciar a leitura da conta.' }); }
    return reply(res, 202, { ok: true, pending: true, job: tokenFor(body.task_id) });
  } catch (error) {
    console.error('Manus create error', error);
    return reply(res, 500, { error: 'Erro interno ao iniciar a análise.' });
  }
};
