const MAX_IMAGE_CHARS = 5_000_000;

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    leitura: {
      type: 'object',
      additionalProperties: false,
      properties: {
        valor_total: { type: ['number', 'null'] },
        consumo_kwh: { type: ['number', 'null'] },
        periodo: { type: ['string', 'null'] },
        vencimento: { type: ['string', 'null'] },
        tarifa_kwh: { type: ['number', 'null'] },
        bandeira: { type: ['string', 'null'] },
        tributos_encargos: { type: ['number', 'null'] },
        iluminacao_publica: { type: ['number', 'null'] },
        distribuidora: { type: ['string', 'null'] },
      },
      required: ['valor_total', 'consumo_kwh', 'periodo', 'vencimento', 'tarifa_kwh', 'bandeira', 'tributos_encargos', 'iluminacao_publica', 'distribuidora'],
    },
    confianca: { type: 'number' },
    observacoes: { type: 'array', items: { type: 'string' } },
    explicacao: { type: 'string' },
    grupos_consumo: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          nome: { type: 'string' },
          percentual: { type: 'number' },
          margem: { type: 'number' },
          justificativa: { type: 'string' },
        },
        required: ['nome', 'percentual', 'margem', 'justificativa'],
      },
    },
    proposta: {
      type: 'object',
      additionalProperties: false,
      properties: {
        economia_mensal: { type: 'number' },
        faixa_minima: { type: 'number' },
        faixa_maxima: { type: 'number' },
        meta_mensal: { type: 'number' },
        recomendacoes: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              titulo: { type: 'string' },
              descricao: { type: 'string' },
              economia_estimada: { type: 'number' },
              custo_estimado: { type: 'number' },
              retorno_meses: { type: ['number', 'null'] },
            },
            required: ['titulo', 'descricao', 'economia_estimada', 'custo_estimado', 'retorno_meses'],
          },
        },
      },
      required: ['economia_mensal', 'faixa_minima', 'faixa_maxima', 'meta_mensal', 'recomendacoes'],
    },
  },
  required: ['leitura', 'confianca', 'observacoes', 'explicacao', 'grupos_consumo', 'proposta'],
};

function reply(res, status, body) {
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return reply(res, 405, { error: 'Método não permitido.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return reply(res, 503, { error: 'A API de IA ainda não foi configurada. Adicione OPENAI_API_KEY nas variáveis da Vercel.' });
  }

  const image = req.body && req.body.image;
  if (typeof image !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) {
    return reply(res, 400, { error: 'Envie uma imagem JPG, PNG ou WEBP em formato data URL.' });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return reply(res, 413, { error: 'A imagem é muito grande. Reduza a foto para até 3 MB.' });
  }

  const baseUrl = (process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const prompt = `Leia esta conta de energia brasileira com cuidado. Responda em português do Brasil.

Regras importantes:
- Extraia somente valores realmente visíveis. Quando não estiver legível ou não existir, use null.
- Nunca invente dados para preencher um campo.
- Diferencie valor da conta, consumo em kWh e tarifa por kWh.
- Tributos/encargos e iluminação pública devem ser valores em reais quando estiverem discriminados; use null caso contrário.
- Grupos de consumo são ESTIMATIVAS, não medições: use no máximo 5 grupos, totalizando aproximadamente 100%, com margem de erro realista.
- A proposta deve ser conservadora, baseada no consumo e no valor lidos. Não prometa economia garantida.
- A economia estimada deve ser 0 quando não houver consumo ou valor confiável. Explique incertezas e o que o usuário deve conferir.
- Retorne JSON seguindo exatamente o schema informado.`;

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_completion_tokens: 2200,
        messages: [
          { role: 'system', content: 'Você é um especialista em leitura transparente de contas de energia. Não invente informações.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: image, detail: 'high' } },
            ],
          },
        ],
        response_format: { type: 'json_schema', json_schema: { name: 'analise_conta_enerlis', strict: true, schema } },
      }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('AI provider error', upstream.status, data?.error?.message || data);
      return reply(res, 502, { error: 'Não foi possível concluir a leitura da conta agora. Tente novamente com uma foto mais nítida.' });
    }

    const content = data?.choices?.[0]?.message?.content;
    if (!content) return reply(res, 502, { error: 'A IA não retornou uma análise válida.' });
    const result = JSON.parse(content);
    result.confianca = Math.max(0, Math.min(1, Number(result.confianca) || 0));
    return reply(res, 200, { ok: true, data: result });
  } catch (error) {
    console.error('Analysis error', error);
    return reply(res, 500, { error: 'Erro interno ao analisar a imagem.' });
  }
};
