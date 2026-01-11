import { listCategories, createCategory, deleteCategory, updateCategory } from '../../lib/database';

export function registerCategoryRoutes(app: any, requireKey: any) {
  app.get('/api/guilds/:guildId/categories', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const categories = listCategories(guildId);
    res.json(categories);
  });

  app.post('/api/guilds/:guildId/categories', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const { name, title, description, discordCategoryId } = req.body || {};
    try {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      const categoryId = createCategory(guildId, name.trim(), discordCategoryId || null, title || null, description || null);
      res.json({ ok: true, id: categoryId });
    } catch (err: any) {
      console.error('Error creating category', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.put('/api/guilds/:guildId/categories/:categoryId', requireKey, (req: any, res: any) => {
    const categoryId = Number(req.params.categoryId);
    const { name, title, description, discordCategoryId } = req.body || {};
    try {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Category name is required' });
      }
      updateCategory(categoryId, {
        name: name.trim(),
        title: title || null,
        description: description || null,
        discordCategoryId: discordCategoryId || null
      });
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error updating category', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.delete('/api/guilds/:guildId/categories/:categoryId', requireKey, (req: any, res: any) => {
    const categoryId = Number(req.params.categoryId);
    try {
      deleteCategory(categoryId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error deleting category', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}
