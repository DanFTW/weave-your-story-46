export type TrelloAutomationPhase = 
  | 'auth-check'
  | 'select-board'
  | 'board-overview'
  | 'select-done-list'
  | 'configure'
  | 'activating'
  | 'active';

export interface TrelloListWithCards extends TrelloList {
  cards: TrelloCard[];
}

export interface TrelloBoard {
  id: string;
  name: string;
  url?: string;
}

export interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

export interface TrelloAutomationConfig {
  id: string;
  userId: string;
  boardId: string | null;
  boardName: string | null;
  doneListId: string | null;
  doneListName: string | null;
  monitorNewCards: boolean;
  monitorCompletedCards: boolean;
  isActive: boolean;
  newCardTriggerId: string | null;
  updatedCardTriggerId: string | null;
  cardsTracked: number;
  completedTracked: number;
}

export interface TrelloAutomationStats {
  cardsTracked: number;
  completedTracked: number;
  isActive: boolean;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc?: string;
  idList: string;
  idBoard: string;
  due?: string;
  dueComplete?: boolean;
  labels?: Array<{ name: string; color: string }>;
  url?: string;
}
