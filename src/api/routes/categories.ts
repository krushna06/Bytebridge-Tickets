import { listCategories, createCategory, deleteCategory, updateCategory, listQuestions, createQuestion, updateQuestion, deleteQuestion, deleteQuestionsByCategory } from '../../lib/database';

export function registerCategoryRoutes(app: any, requireKey: any) {
  app.get('/api/guilds/:guildId/categories', requireKey, (req: any, res: any) => {
    const guildId = req.params.guildId;
    const categories = listCategories(guildId);
    const withQuestions = categories.map(cat => ({
      ...cat,
      questions: listQuestions(cat.id)
    }));
    res.json(withQuestions);
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
      deleteQuestionsByCategory(categoryId);
      deleteCategory(categoryId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error deleting category', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.post('/api/guilds/:guildId/categories/:categoryId/questions', requireKey, (req: any, res: any) => {
    const categoryId = Number(req.params.categoryId);
    const { question, placeholder, required } = req.body || {};
    try {
      if (!question || !question.trim()) {
        return res.status(400).json({ error: 'Question text is required' });
      }
      const questions = listQuestions(categoryId);
      if (questions.length >= 5) {
        return res.status(400).json({ error: 'Maximum 5 questions allowed per category' });
      }
      const questionId = createQuestion(categoryId, question.trim(), placeholder || null, required !== false, questions.length);
      res.json({ ok: true, id: questionId });
    } catch (err: any) {
      console.error('Error creating question', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.put('/api/guilds/:guildId/categories/:categoryId/questions/:questionId', requireKey, (req: any, res: any) => {
    const questionId = Number(req.params.questionId);
    const { question, placeholder, required, order_index } = req.body || {};
    try {
      if (!question || !question.trim()) {
        return res.status(400).json({ error: 'Question text is required' });
      }
      updateQuestion(questionId, {
        question: question.trim(),
        placeholder: placeholder || null,
        required: required !== false,
        order_index
      });
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error updating question', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });

  app.delete('/api/guilds/:guildId/categories/:categoryId/questions/:questionId', requireKey, (req: any, res: any) => {
    const questionId = Number(req.params.questionId);
    try {
      deleteQuestion(questionId);
      res.json({ ok: true });
    } catch (err: any) {
      console.error('Error deleting question', err);
      res.status(500).json({ error: err?.message || 'internal error' });
    }
  });
}
