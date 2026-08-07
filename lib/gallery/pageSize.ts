// Vive fuori da app/actions/loadMorePhotos.ts perche un file 'use server' puo
// esportare solo funzioni asincrone: esportare qui la costante azzererebbe
// l intero export del modulo, inclusa la Server Action.
export const PAGE_SIZE = 24
