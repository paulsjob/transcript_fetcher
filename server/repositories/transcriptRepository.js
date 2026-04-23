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
