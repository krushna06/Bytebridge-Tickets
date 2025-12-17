import * as general from './handlers/general';
import * as ticket from './handlers/ticket';
import * as notes from './handlers/notes';
import * as stats from './handlers/stats';
import * as panels from './handlers/panels';

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
