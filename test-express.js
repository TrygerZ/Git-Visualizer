import express from 'express';
const app = express();
app.get('/test', (req, res) => {
  res.status(undefined).json({error: 'test'});
});
app.listen(3001, () => console.log('started'));
