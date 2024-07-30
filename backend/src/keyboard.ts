export const hobbiesOptions = [
    [{ text: '🎵 Музыка', callback_data: 'hobby_music' },{ text: '🎨 Искусство', callback_data: 'hobby_art' }],
    [{ text: '🏃 Спорт', callback_data: 'hobby_sport' },{ text: '🌍 Путешествия', callback_data: 'hobby_travel' }],
    [{ text: '🍲 Еда', callback_data: 'hobby_food' },{ text: '🎭 Театр', callback_data: 'hobby_theater' }],
    [{ text: '🎤 Комедия', callback_data: 'hobby_comedy' },{ text: '🎉 Фестиваль', callback_data: 'hobby_festival' }],
  ];



  export const createHobbiesKeyboard = (selectedHobbies: string[]) => {
    return {
      inline_keyboard: [
        ...hobbiesOptions.map(row =>
          row.map(option => {
            const selected = selectedHobbies.includes(option.callback_data);
            return {
              text: `${selected ? '✅' : '➖'} ${option.text}`,
              callback_data: option.callback_data
            };
          })
        ),
        [{ text: 'Готово', callback_data: 'hobbies_done' }]
      ]
    };
  };
  
  
  
  
  
  export const createPreferencesMenu = () => {
    return {
      inline_keyboard: [
        [{ text: 'Изменить бюджет', callback_data: 'change_budget' }],
        [{ text: 'Изменить увлечения', callback_data: 'change_hobbies' }]
      ],
      resize_keyboard: true
    };
  };
  