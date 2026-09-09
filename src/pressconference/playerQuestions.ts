import type { PlayerPressQuestion } from '../types/PlayerPressConference';

export const PLAYER_PRESS_QUESTIONS: PlayerPressQuestion[] = [
  // ── Pré-jogo ──────────────────────────────────────────────────────────
  {
    id: 'pp_pre_geral',
    context: 'pre_match',
    prompt: 'Como você chega para o jogo de hoje?',
    options: [
      { id: 'confiante', label: 'Confiante, o time está bem preparado', effects: { fanReputation: 3 }, headlineHint: 'Confiante para o próximo desafio' },
      { id: 'tranquilo', label: 'Tranquilo, um jogo de cada vez', effects: { coachConfidence: 2 }, headlineHint: 'Prega calma antes do jogo' },
      { id: 'humilde', label: 'Respeitando bastante o adversário', effects: { coachConfidence: 3, fanReputation: -1 }, headlineHint: 'Evita provocações antes da bola rolar' },
    ],
  },
  {
    id: 'pp_pre_cobranca_tecnico',
    context: 'pre_match',
    prompt: 'Sente que precisa provar algo para a comissão técnica hoje?',
    tags: { coachMax: 55 },
    options: [
      { id: 'sim', label: 'Sim, quero mostrar que mereço a titularidade', effects: { coachConfidence: 5, morale: 3 }, headlineHint: 'Promete resposta dentro de campo' },
      { id: 'nao', label: 'Não penso assim, só quero ajudar o time', effects: { coachConfidence: 1 }, headlineHint: 'Minimiza a pressão pela vaga' },
    ],
  },
  {
    id: 'pp_pre_pressao_torcida',
    context: 'pre_match',
    prompt: 'A torcida está bastante confiante em você. Sente a pressão?',
    tags: { fanMin: 65 },
    options: [
      { id: 'motiva', label: 'Isso me motiva, quero retribuir o carinho', effects: { fanReputation: 4, morale: 2 }, headlineHint: 'Diz que o carinho da torcida motiva' },
      { id: 'neutro', label: 'Prefiro deixar isso de lado e focar no jogo', effects: { fanReputation: -1 }, headlineHint: 'Evita falar sobre expectativa da torcida' },
    ],
  },
  {
    id: 'pp_pre_preparo',
    context: 'pre_match',
    prompt: 'O que muda no seu preparo para esta partida específica?',
    options: [
      { id: 'detalhes', label: 'Estudamos bastante os detalhes do adversário', effects: { coachConfidence: 2 }, headlineHint: 'Fala em preparação detalhada' },
      { id: 'rotina', label: 'Nada muda, sigo a mesma rotina de sempre', effects: { morale: 1 }, headlineHint: 'Mantém a rotina de sempre' },
    ],
  },

  // ── Pós-jogo ──────────────────────────────────────────────────────────
  {
    id: 'pp_post_vitoria_gol',
    context: 'post_match',
    prompt: 'Marcou hoje e o time venceu. Como foi o gol?',
    tags: { results: ['win'], scoredGoal: true },
    options: [
      { id: 'time', label: 'O mérito é do time, joguei fácil', effects: { coachConfidence: 4, fanReputation: 5 }, headlineHint: 'Divide o mérito do gol com o time' },
      { id: 'individual', label: 'Trabalhei muito para essa jogada, orgulho pessoal', effects: { fanReputation: 6, coachConfidence: -1 }, headlineHint: 'Comemora com orgulho o próprio gol' },
    ],
  },
  {
    id: 'pp_post_vitoria_geral',
    context: 'post_match',
    prompt: 'Vitória do time hoje. Qual sua avaliação da partida?',
    tags: { results: ['win'] },
    options: [
      { id: 'coletivo', label: 'Vitória de equipe, todo mundo ajudou', effects: { coachConfidence: 4, fanReputation: 3 }, headlineHint: 'Elogia o coletivo após a vitória' },
      { id: 'seguir', label: 'Bom resultado, mas o foco já é o próximo jogo', effects: { coachConfidence: 2, morale: 2 }, headlineHint: 'Já projeta o próximo compromisso' },
    ],
  },
  {
    id: 'pp_post_derrota',
    context: 'post_match',
    prompt: 'Derrota hoje. O que faltou para o time?',
    tags: { results: ['loss'] },
    options: [
      { id: 'autocritica', label: 'Faltou entrega nossa, a culpa é do elenco', effects: { coachConfidence: 4, morale: -4 }, headlineHint: 'Assume a responsabilidade pela derrota' },
      { id: 'detalhes', label: 'Foram detalhes, o time fez um bom jogo', effects: { fanReputation: -3, coachConfidence: 1 }, headlineHint: 'Minimiza a derrota como "detalhes"' },
      { id: 'arbitragem', label: 'Alguns lances da arbitragem pesaram no resultado', effects: { fanReputation: 2, coachConfidence: -4 }, headlineHint: 'Reclama de lances da arbitragem' },
    ],
  },
  {
    id: 'pp_post_empate',
    context: 'post_match',
    prompt: 'Empate no placar hoje. Como avalia o resultado?',
    tags: { results: ['draw'] },
    options: [
      { id: 'justo', label: 'Foi um resultado justo pelo que os dois times fizeram', effects: { coachConfidence: 2 }, headlineHint: 'Considera o empate justo' },
      { id: 'perdeu2', label: 'Sinto que perdemos dois pontos hoje', effects: { fanReputation: 3, coachConfidence: -2 }, headlineHint: 'Lamenta pontos perdidos no empate' },
    ],
  },
  {
    id: 'pp_post_nota_baixa',
    context: 'post_match',
    prompt: 'Nota baixa na súmula hoje. O que houve dentro de campo?',
    tags: { poorRating: true },
    options: [
      { id: 'reconhece', label: 'Não foi meu melhor dia, vou trabalhar para melhorar', effects: { coachConfidence: 3, morale: -2 }, headlineHint: 'Reconhece atuação abaixo do esperado' },
      { id: 'defende', label: 'Dei meu melhor, o resultado individual não conta tudo', effects: { fanReputation: -3 }, headlineHint: 'Se defende de críticas pela atuação' },
    ],
  },
  {
    id: 'pp_post_nota_alta',
    context: 'post_match',
    prompt: 'Atuação de gala hoje. Como se sente com a evolução?',
    tags: { greatRating: true },
    options: [
      { id: 'trabalho', label: 'É fruto de muito trabalho nos treinos', effects: { coachConfidence: 5, fanReputation: 4 }, headlineHint: 'Credita a boa fase ao trabalho nos treinos' },
      { id: 'confianca', label: 'Estou jogando com muita confiança agora', effects: { fanReputation: 6, morale: 3 }, headlineHint: 'Celebra o momento de confiança' },
    ],
  },
  {
    id: 'pp_post_banco',
    context: 'post_match',
    prompt: 'Ficou fora dos relacionados hoje. Como lida com esse momento?',
    tags: { benched: true },
    options: [
      { id: 'profissional', label: 'É uma decisão da comissão técnica, respeito e trabalho', effects: { coachConfidence: 5, morale: -1 }, headlineHint: 'Diz respeitar a decisão da comissão técnica' },
      { id: 'incomodado', label: 'Não vou esconder que me incomoda ficar de fora', effects: { coachConfidence: -3, fanReputation: 2 }, headlineHint: 'Admite desconforto por ficar fora' },
    ],
  },
  {
    id: 'pp_post_temporada',
    context: 'post_match',
    prompt: 'Como avalia sua temporada até aqui?',
    options: [
      { id: 'positiva', label: 'Estou satisfeito, mas quero mais', effects: { fanReputation: 2, morale: 2 } },
      { id: 'evoluir', label: 'Ainda tenho muito a evoluir', effects: { coachConfidence: 2 } },
    ],
  },
];
