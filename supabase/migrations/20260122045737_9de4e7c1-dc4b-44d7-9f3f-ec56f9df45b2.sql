UPDATE user_integrations 
SET account_avatar_url = REPLACE(account_avatar_url, 'trello-members', 'trello-avatars')
WHERE integration_id = 'trello' 
AND account_avatar_url LIKE '%trello-members%';