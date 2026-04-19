-- Allow JSON timing files alongside the WAV audio in the tts-audio bucket.
update storage.buckets
   set allowed_mime_types = array['audio/wav', 'audio/mpeg', 'audio/mp3', 'application/json']
 where id = 'tts-audio';
