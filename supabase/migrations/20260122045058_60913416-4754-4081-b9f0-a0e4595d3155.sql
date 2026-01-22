UPDATE user_integrations 
SET account_avatar_url = REPLACE(
  REPLACE(account_avatar_url, 'trello-members', 'trello-avatars'),
  '/170.png', ''
)
WHERE integration_id = 'trello' 
AND account_avatar_url LIKE '%trello-members%';