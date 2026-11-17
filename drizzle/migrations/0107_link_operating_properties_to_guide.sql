UPDATE public.implementation_projects p SET core_property_id = v.core::uuid
FROM (VALUES
('IMP-00033','293d9386-8920-4dbd-9ec2-ac085bbe397a'),
('IMP-00026','39274d12-65f5-45e9-b528-0c6069afcffb'),
('IMP-00034','c1394c90-6b20-437c-8188-5b21770fce8a'),
('IMP-00027','9deaabd2-0292-45d6-9ecb-105e87c61630'),
('IMP-00014','081b652c-b45e-4484-a370-a09cb50dc350'),
('IMP-00008','c2793b80-4991-496e-9d1c-d908387f2004'),
('IMP-00032','09936562-edb8-4b89-ace8-32c8eb01d515'),
('IMP-00031','7c17f5a1-d8e7-4c15-ad5b-532dbdde0924'),
('IMP-00025','a21fe19e-e143-4121-864a-062e20a69f27'),
('IMP-00009','01a3d846-0837-4c55-a3b6-ea54930a6228'),
('IMP-00028','f0ccad56-e7f2-4f34-9839-fb7866fabba2'),
('IMP-00030','db79eb15-e9be-4685-8ed9-8539370f5043'),
('IMP-00029','8d22b212-a933-4098-9ab5-75c03a766b0f'),
('IMP-00035','eba90963-a5d4-4ba9-b795-b6721af82856')
) AS v(code, core)
WHERE p.code = v.code AND p.core_property_id IS NULL;