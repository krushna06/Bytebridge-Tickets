import help from './General/help';
import _new from './General/new';
import tag from './General/tag';
import tickets from './General/tickets';

import claim from './Staff/claim';
import forceClose from './Staff/forceClose';
import priority from './Staff/priority';
import release from './Staff/release';
import move from './Staff/move';
import transfer from './Staff/transfer';
import panel from './Staff/panel';
import sendpanel from './Staff/sendpanel';
import setstaff from './Staff/setstaff';
import settranscript from './Staff/settranscript';
import setfeedback from './Staff/setfeedback';

import leaderboard from './Stats/leaderboard';
import stats from './Stats/stats';
import setprofile from './Stats/setprofile';
import viewprofile from './Stats/viewprofile';

import add from './Ticket/add';
import remove from './Ticket/remove';
import close from './Ticket/close';
import rename from './Ticket/rename';
import topic from './Ticket/topic';
import transcript from './Ticket/transcript';

import note from './Notes/note';
import stickynotes from './Notes/stickynotes';
import viewnotes from './Notes/viewnotes';

const commands = [
  help, _new, tag, tickets,
  claim, forceClose, move, priority, release, transfer,
  panel, sendpanel,
  setstaff,
  settranscript,
  setfeedback,
  leaderboard, stats, setprofile, viewprofile,
  add, remove, close, rename, topic, transcript,
  note, stickynotes, viewnotes
];

export default commands;
