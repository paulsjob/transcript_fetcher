import prisma from '../lib/prisma.js';

export async function upsertTranscript({ videoId, title, transcript }) {
  const transcriptText = transcript.map((entry) => entry.text).join(' ').trim();
  const transcriptJson = JSON.stringify(transcript);

  return prisma.transcript.upsert({
    where: { videoId },
    update: {
      title,
      transcriptText,
      transcriptJson,
      fetchedAt: new Date()
    },
    create: {
      videoId,
      title,
      transcriptText,
      transcriptJson
    }
  });
}

export async function searchTranscripts(query) {
  return prisma.transcript.findMany({
    where: {
      OR: [{ title: { contains: query } }, { transcriptText: { contains: query } }]
    },
    select: {
      id: true,
      videoId: true,
      title: true,
      transcriptText: true
    },
    orderBy: {
      fetchedAt: 'desc'
    },
    take: 50
  });
}

export async function listTranscripts() {
  return prisma.transcript.findMany({
    select: {
      id: true,
      videoId: true,
      title: true,
      fetchedAt: true,
      transcriptText: true
    },
    orderBy: {
      fetchedAt: 'desc'
    }
  });
}

export async function getTranscriptById(id) {
  return prisma.transcript.findUnique({
    where: { id },
    select: {
      id: true,
      videoId: true,
      title: true,
      fetchedAt: true,
      transcriptJson: true,
      transcriptText: true
    }
  });
}

export async function deleteTranscriptById(id) {
  const result = await prisma.transcript.deleteMany({
    where: { id }
  });

  return result.count > 0;
}

export async function findAllVideoIds() {
  const rows = await prisma.transcript.findMany({
    select: { videoId: true }
  });

  return rows.map((row) => row.videoId);
}

export async function hasTranscriptByVideoId(videoId) {
  const transcript = await prisma.transcript.findUnique({
    where: { videoId },
    select: { id: true }
  });

  return Boolean(transcript);
}
