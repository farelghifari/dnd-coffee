import os

path = r'c:\Users\BUSINESS ASIASISTEM\Downloads\dnd-coffee\app\admin\report\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
skip_next = False
for i in range(len(lines)):
    if skip_next:
        skip_next = False
        continue
    
    # Target line 886 (index 885)
    if i == 885 and '</Card>' in lines[i]:
        print(f"Skipping line {i+1}: {lines[i].strip()}")
        continue
    
    new_lines.append(lines[i])

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
