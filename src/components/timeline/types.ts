import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PostType = "post" | "announcement" | "event" | "poll";

export const TYPE_META: Record<PostType, { label: string; perm: "post.create" | "announcement.create" | "event.create" | "poll.create" }> = {
  post: { label: "Postagem", perm: "post.create" },
  announcement: { label: "Comunicado", perm: "announcement.create" },
  event: { label: "Evento", perm: "event.create" },
  poll: { label: "Enquete", perm: "poll.create" },
};

const SELECT = `*,
  author:profiles!posts_author_id_fkey(id, full_name, job_title),
  post_attachments(*),
  poll_options(*),
  poll_votes(option_id, user_id),
  post_likes(user_id),
  post_comments(id, content, created_at, author_id, author:profiles!post_comments_author_id_fkey(full_name)),
  read_confirmations(user_id, confirmed_at, profile:profiles!read_confirmations_user_id_fkey(full_name))`;

async function fetchFeed() {
  const { data, error } = await supabase.from("posts").select(SELECT).order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  const paths = data.flatMap((p) => p.post_attachments.map((a) => a.path));
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("attachments").createSignedUrls(paths, 60 * 60);
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    });
  }
  return data.map((p) => ({
    ...p,
    post_attachments: p.post_attachments.map((a) => ({ ...a, url: urls[a.path] })),
    poll_options: [...p.poll_options].sort((a, b) => a.position - b.position),
    post_comments: [...p.post_comments].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }));
}

export const feedQuery = queryOptions({ queryKey: ["feed"], queryFn: fetchFeed });
export type FeedPost = Awaited<ReturnType<typeof fetchFeed>>[number];
