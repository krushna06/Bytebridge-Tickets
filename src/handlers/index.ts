import * as general from './general';
import * as ticket from './ticket';
import * as notes from './notes';
import * as stats from './stats';
import * as panels from './panels';

export default {
  help: general.help,
  new: general._new,
  tag: general.tag,
  tickets: general.tickets,

  add: ticket.add,
  remove: ticket.remove,
  transfer: ticket.transfer,

  note: notes.note,
  stickynotes: notes.stickynotes,
  viewnotes: notes.viewnotes,

  claim: ticket.claim,
  forceClose: ticket.forceClose,
  move: ticket.move,
  priority: ticket.priority,
  release: ticket.release,

  leaderboard: stats.leaderboard,
  setprofile: stats.setprofile,
  stats: stats.stats,
  viewprofile: stats.viewprofile,

  close: ticket.close,
  rename: ticket.rename,
  topic: ticket.topic,
  transcript: ticket.transcript,

  panel: panels.panel,
  sendpanel: panels.sendpanel
};
