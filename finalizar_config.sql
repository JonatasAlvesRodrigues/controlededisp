
-- 1. Desabilita RLS (caso não tenha sido feito ainda)
ALTER TABLE classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;

-- 2. (Opcional) Insere dados de exemplo para testar
-- Turmas
INSERT INTO classes (name, shift, students) VALUES
('7ºA', 'Matutino', 30),
('8ºB', 'Vespertino', 28),
('9ºC', 'Matutino', 32),
('1ºA', 'Vespertino', 29);

-- Professores
INSERT INTO teachers (name, subject) VALUES
('Carlos Mendes', 'Matemática'),
('Ana Paula', 'Ciências'),
('Ricardo Alves', 'História'),
('Juliana Costa', 'Geografia');

-- Dispositivos
INSERT INTO devices (type, patrimony, "group", status) VALUES
('Notebook', 'PAT001', 'Base 1', 'Disponível'),
('Notebook', 'PAT002', 'Base 1', 'Disponível'),
('Notebook', 'PAT003', 'Base 1', 'Disponível'),
('Notebook', 'PAT004', 'Base 1', 'Disponível'),
('Notebook', 'PAT005', 'Base 1', 'Disponível'),
('Notebook', 'PAT006', 'Base 2', 'Disponível'),
('Notebook', 'PAT007', 'Base 2', 'Disponível'),
('Tablet', 'PAT008', 'Carrinho A', 'Disponível'),
('Tablet', 'PAT009', 'Carrinho A', 'Disponível'),
('Tablet', 'PAT010', 'Carrinho A', 'Disponível');

