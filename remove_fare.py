filepath = r'c:\Projects\Rides-mobile\artifacts\mobile\app\(driver)\index.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = [l for l in lines if not any(k in l for k in ['fareRow:', 'fareLabel:', 'fareValue:'])]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Done.")
