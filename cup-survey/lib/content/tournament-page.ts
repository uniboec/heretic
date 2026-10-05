import { registrationClosesAt as defaultRegistrationClosesAt, tournamentInfo } from '../config/tournament'
import { formatRegistrationCloseShort } from '../datetime/tournament'

export const EDIT_REGISTRATION_FAQ_QUESTION = 'Можно изменить заявку?'

function resolveRegistrationCloseAt(closesAt?: string | null): string {
  return closesAt ?? defaultRegistrationClosesAt
}

export function registrationDeadlineLabel(closesAt?: string | null): string {
  const when = formatRegistrationCloseShort(resolveRegistrationCloseAt(closesAt))
  return when ? `Регистрация закроется ${when}` : 'Регистрация скоро закроется'
}

export function registrationFeesNote(closesAt?: string | null): string {
  return `Взнос за каждую категорию. Тариф определяется датой отправки квитанции в личном кабинете, а не датой перевода. ${registrationDeadlineLabel(closesAt)}.`
}

export function registrationEditPageDescription(closesAt?: string | null): string {
  const when = formatRegistrationCloseShort(resolveRegistrationCloseAt(closesAt))
  return when ? `Можно изменить до ${when}.` : 'Можно изменить до закрытия регистрации.'
}

export function registrationEditFaqAnswer(closesAt?: string | null): string {
  const when = formatRegistrationCloseShort(resolveRegistrationCloseAt(closesAt))
  return when ? `Да, до ${when} — в разделе «Мои заявки».` : 'Да, до закрытия регистрации — в разделе «Мои заявки».'
}

export const tournamentPageCopy = {
  hero: {
    cta: 'Зарегистрироваться',
    ctaClosed: 'Регистрация закрыта',
    priceNote: 'категория',
    priceBoth: (amount: string) => `две дисциплины — ${amount}`,
    stagesTitle: 'Взносы',
  },
  cta: {
    register: 'Зарегистрироваться',
    finalTitle: 'Готовы участвовать?',
  },
  participantsTeaser: {
    eyebrow: 'Участники',
    titleWithAthletes: 'Уже зарегистрировались',
    titleEmpty: 'Список участников',
    descriptionEmpty: 'Пока заявок нет — станьте первым, кто попадёт в список',
    descriptionLive: 'Список обновляется по мере подачи заявок',
    cta: 'Смотреть участников',
  },
  essentials: {
    title: 'О турнире',
    lead: `${tournamentInfo.eventDateLabel}, ${tournamentInfo.venue.city} — региональный турнир по смешанным единоборствам под эгидой ФСЕ России. Соревнования проходят в двух дисциплинах, с разделением по уровню подготовки и параллельной работой двух ковров.`,
    format: {
      title: 'Формат',
      items: [
        {
          icon: 'disciplines',
          title: 'Две дисциплины',
          text: 'Tactic-Control — в кимоно, Close-Control — в рашгарде и шортах',
        },
        {
          icon: 'divisions',
          title: 'Два дивизиона',
          text: '«Новички» и «Опытные» — отдельные зачёты в каждой категории',
        },
        {
          icon: 'mats',
          title: 'Два ковра',
          text: 'Поединки идут одновременно — меньше ожидания между выходами',
        },
      ],
    },
    awards: {
      title: 'Награды и преимущества',
      items: [
        {
          icon: 'medal',
          title: 'Медали',
          text: 'Всем призёрам категорий',
        },
        {
          icon: 'diploma',
          title: 'Электронные дипломы',
          text: 'Фирменные дипломы участникам',
        },
        {
          icon: 'trophy',
          title: 'Кубки',
          text: 'Победителям в дивизионе «Опытные»',
        },
        {
          icon: 'rank',
          title: '1 взрослый разряд',
          text: 'При выполнении условий ЕВСК ФСЕ России',
        },
      ],
    },
  },
  partnerBonus: {
    badge: 'Партнёр турнира',
    title: 'Подарок каждой команде — сертификат',
    partnerName: 'Fight CRM',
    description:
      'CRM для клубов единоборств: клиенты, абонементы, расписание, посещения и оплаты — в одной системе, без Excel. Сертификат можно использовать при оплате сервиса.',
    amount: '500 ₽',
    footnote: 'Один сертификат на команду, заявившую участников.',
    cta: 'Подробнее',
    url: 'https://fightcrm.ru',
  },
  combatContentPartner: {
    badge: 'Партнёр турнира',
    title: 'Контент для клубов единоборств',
    partnerName: 'COMBAT CONTENT',
    description:
      'Контент-менеджер из мира единоборств: понимает боли тренеров, страхи родителей, мотивацию детей и задачи клуба. Создаёт не просто красивые посты, а контент, который цепляет, вызывает доверие и помогает развиваться.',
    cta: 'Подробнее',
    url: 'https://vk.ru/combatcontent',
  },
  fees: {
    title: 'Взносы и регистрация',
  },
  divisions: {
    title: 'Дивизионы по уровню подготовки',
    lead: 'Чтобы спортсмены соревновались с соперниками сопоставимого уровня, участники распределяются по дивизионам.',
    footnote: 'В соответствии с критериями положения о соревнованиях.',
    disclaimer:
      'При явном несоответствии заявленного уровня организатор вправе перевести спортсмена в соответствующий дивизион.',
    novice: {
      title: 'Новички',
      level: 'Начальный уровень',
      criteria: [
        'Стаж в единоборствах до 1 года',
        'Не более 3 соревнований',
        'Спортивная квалификация не выше III разряда',
        'Без побед на региональных и призовых мест на межрегиональных, всероссийских и международных турнирах',
      ],
    },
    experienced: {
      title: 'Опытные',
      level: 'Продвинутый уровень',
      criteria: [
        'Стаж более 1 года',
        'Опыт более 3 соревнований',
        'II разряд и выше либо победы и призовые места на соревнованиях соответствующего уровня',
      ],
    },
  },
  categories: {
    title: 'Категории',
    columns: {
      gender: 'Пол',
      division: 'Группа',
      age: 'Возраст',
      weights: 'Вес, кг',
    },
    groups: {
      children: 'Дети',
      youth: 'Юноши и девушки',
      juniors: 'Юниоры',
      adults: 'Взрослые',
      veterans: 'Ветераны',
    },
  },
  schedule: {
    title: 'День соревнований',
    items: [
      { time: '9:00', label: 'Взвешивание' },
      { time: '10:00 – 17:00', label: 'Поединки' },
      { time: 'по готовности', label: 'Награждение в категории' },
    ],
  },
  contacts: {
    title: 'Вопросы?',
    phoneLabel: 'Телефон',
    emailLabel: 'Почта',
  },
  faq: {
    title: 'Частые вопросы',
    items: [
      {
        q: 'Можно выступить в нескольких категориях?',
        a: 'Да. Можно добавить несколько категорий, в том числе в одной дисциплине. Каждая оплачивается отдельно.',
      },
      {
        q: EDIT_REGISTRATION_FAQ_QUESTION,
        a: registrationEditFaqAnswer(),
      },
      {
        q: 'Моего клуба нет в списке?',
        a: 'Нажмите «Добавить клуб» и укажите название с городом.',
      },
      {
        q: 'Что взять с собой?',
        a: 'Документы, медсправку, страховку, экипировку по дисциплине.',
      },
    ],
  },
  participants: {
    title: 'Участники',
    description:
      'Кто уже зарегистрировался на Кубок Свердловской области. Найдите спортсмена, клуб или категорию.',
    emptyTitle: 'Пока нет зарегистрированных участников',
    emptyDescription:
      'Список обновляется по мере подачи заявок. Зарегистрируйтесь, чтобы попасть в него.',
    emptyFilteredTitle: 'Ничего не найдено',
    emptyFilteredDescription: 'Попробуйте изменить фильтры или сбросить поиск.',
    empty: 'Пока никто не зарегистрировался.',
    emptyFiltered: 'Ничего не найдено.',
    backToTournament: 'Вернуться к турниру',
    registerCta: 'Зарегистрироваться',
    viewLabel: 'Вид',
    categoriesTitle: 'Категории',
    categoriesNote: 'Предварительный список. Финальный — после закрытия регистрации и взвешивания.',
    stats: {
      athletes: 'Спортсменов',
      clubs: 'Клубов',
      tactic: 'Tactic-Control',
      close: 'Close-Control',
      entries: 'Категорий',
      disciplinesHint: 'Заявок по дисциплинам',
    },
    filters: {
      title: 'Фильтры',
      show: 'Фильтры',
      hide: 'Скрыть',
      reset: 'Сбросить',
      search: 'Поиск',
      searchPlaceholder: 'Поиск спортсмена или клуба…',
      allDisciplines: 'Все дисциплины',
      allGenders: 'Любой пол',
      clubPlaceholder: 'Клуб или город',
      namePlaceholder: 'ФИО спортсмена',
      weightMin: 'Вес от, кг',
      weightMax: 'Вес до, кг',
      ageMin: 'Возраст от',
      ageMax: 'Возраст до',
      allAgeDivisions: 'Все возрастные',
      allWeightCategories: 'Все весовые',
      allExperienceLevels: 'Все группы',
      allPaymentStatuses: 'Все статусы оплаты',
      paymentStatus: 'Оплата',
      sortBy: 'Сортировка',
      sortName: 'По имени',
      sortClub: 'По клубу',
      sortCategory: 'По категории',
      viewList: 'Список',
      viewCategories: 'Категории',
      viewClubs: 'Клубы',
      ageDivision: 'Возрастная категория',
      weightCategory: 'Весовая категория',
      experienceLevel: 'Группа',
    },
    columns: {
      name: 'Спортсмен',
      club: 'Клуб',
      gender: 'Пол',
      age: 'Возраст',
      disciplines: 'Дисциплины',
      category: 'Категория',
      weight: 'Вес',
      status: 'Статус',
    },
    edit: {
      label: 'Редактировать заявку',
      title: 'Секретный код',
      description:
        'Введите секретный код, который вы задали при регистрации. После проверки откроется форма редактирования заявки.',
      submit: 'Продолжить',
    },
  },
  teams: {
    title: 'Команды',
    description:
      'Командный зачёт по клубам на основе призовых мест спортсменов. Обновляется по мере завершения поединков.',
    loading: 'Загрузка командного зачёта…',
    backToTournament: '← К соревнованию',
    statsTemplate: (clubs: string) => `${clubs} в зачёте`,
    pollingError: 'Не удалось обновить · повторяем',
    disabledTitle: 'Раздел недоступен',
    disabledDescription: 'Публичная страница командного зачёта отключена организаторами турнира.',
    loadErrorTitle: 'Не удалось загрузить командный зачёт',
    loadErrorDescription:
      'Попробуйте обновить страницу. Если ошибка повторяется — сообщите организаторам.',
    unpublishedTitle: 'Командный зачёт пока не опубликован',
    unpublishedDescription:
      'Организаторы ещё не опубликовали сетки на сайте. Загляните позже.',
    emptyTitle: 'Команды пока не отображаются',
    emptyDescription: 'Как только появятся участники в опубликованных сетках, зачёт отобразится здесь.',
    completeBannerTitle: 'Итоговый командный зачёт',
    completeBannerDescription: 'Все категории выбранной дисциплины завершены.',
    disciplineLabel: 'Дисциплина',
    disciplineAll: 'Все дисциплины',
    placeLabel: (rank: number) => `${rank} место`,
    columns: {
      rank: 'Место',
      club: 'Клуб',
      points: 'Баллы',
      first: '1 место',
      second: '2 место',
      third: '3 место',
      wins: 'Победы',
      fights: 'Бои',
    },
  },
  normQualifications: {
    title: 'Выполнение нормативов',
    description:
      'По результатам соревнований в дисциплине выполнен норматив разряда по ЕВСК.',
    loading: 'Загрузка нормативов…',
    backToTournament: '← К соревнованию',
    disabledTitle: 'Раздел недоступен',
    disabledDescription:
      'Публичная страница нормативов появится после расчёта и включения публикации организаторами.',
    loadErrorTitle: 'Не удалось загрузить нормативы',
    loadErrorDescription:
      'Попробуйте обновить страницу. Если ошибка повторяется — сообщите организаторам.',
    emptyTitle: 'Нормативы пока не отображаются',
    emptyDescription:
      'По результатам турнира ни у одного спортсмена не зафиксировано выполнение норматива ЕВСК.',
    columns: {
      athlete: 'Спортсмен',
      category: 'Результат',
      achieved: 'Выполнен',
    },
    filters: {
      search: 'Поиск',
      searchPlaceholder: 'Спортсмен, клуб или город',
      discipline: 'Дисциплина',
      disciplineAll: 'Все',
      rank: 'Разряд',
      rankAll: 'Все разряды',
      emptyFilteredTitle: 'Ничего не найдено',
      emptyFilteredDescription: 'Попробуйте изменить фильтры или поисковый запрос.',
    },
  },
  bouts: {
    completionLabel: 'Поединки',
    filterStatusLabel: 'Статус',
    filterMatLabel: 'Ковёр',
    completionActive: 'Актуальные',
    completionCompleted: 'Завершённые',
    completionAll: 'Все',
    emptyActiveTitle: 'Нет актуальных поединков',
    emptyActiveDescription:
      'Все поединки по текущим фильтрам уже завершены. Переключитесь на «Завершённые» или «Все».',
    emptyCompletedTitle: 'Нет завершённых поединков',
    emptyCompletedDescription: 'Пока ни один поединок не завершён.',
  },
  brackets: {
    completionLabel: 'Сетки',
    filterStatusLabel: 'Статус',
    completionActive: 'Актуальные',
    completionCompleted: 'Завершённые',
    completionAll: 'Все',
    completedBadge: 'Завершена',
    emptyActiveTitle: 'Нет актуальных сеток',
    emptyActiveDescription:
      'Все категории по текущим фильтрам уже завершены. Переключитесь на «Завершённые» или «Все».',
    emptyCompletedTitle: 'Нет завершённых сеток',
    emptyCompletedDescription: 'Пока ни одна категория не завершила все поединки.',
  },
  fastestFights: {
    title: 'Самые быстрые поединки',
    description: 'Топ-10 самых быстрых побед болевым, удушающим и явным преимуществом',
    empty: 'Пока нет досрочных побед',
    columns: {
      rank: 'Место',
      athlete: 'Спортсмен',
      club: 'Клуб',
      time: 'Время',
      method: 'Способ',
      category: 'Категория',
    },
  },
  results: {
    title: 'Результаты',
    description:
      'Чемпионы и призёры турнира по категориям. Список обновляется по мере определения мест в сетках.',
    loading: 'Загрузка результатов…',
    backToTournament: '← К соревнованию',
    statsTemplate: (medalists: string, categories: string) => `${medalists} в ${categories}`,
    pollingError: 'Не удалось обновить · повторяем',
    disabledTitle: 'Раздел недоступен',
    disabledDescription: 'Публичная страница результатов отключена организаторами турнира.',
    loadErrorTitle: 'Не удалось загрузить результаты',
    loadErrorDescription:
      'Попробуйте обновить страницу. Если ошибка повторяется — сообщите организаторам.',
    unpublishedTitle: 'Результаты пока не опубликованы',
    unpublishedDescription:
      'Организаторы ещё не опубликовали сетки на сайте. Загляните позже.',
    emptyTitle: 'Призовые места пока не определены',
    emptyDescription: 'Как только появятся первые итоги в сетках, они отобразятся здесь.',
    filteredEmptyTitle: 'Ничего не найдено',
    filteredEmptyDescription: 'Попробуйте изменить фильтры или сбросить поиск.',
    searchPlaceholder: 'Фамилия, имя, клуб или категория',
    tabs: {
      results: 'Результаты',
      rating: 'Рейтинг',
      fastest: 'Самые быстрые поединки',
    },
  },
  athleteRatings: {
    overall: 'Общий',
    tacticControl: 'Тактик Контрол',
    closeControl: 'Клоус Контрол',
    loading: 'Загрузка рейтинга…',
    empty: 'Рейтинг пока не сформирован',
    disabled: 'Публичный рейтинг отключён организатором',
    loadError: 'Не удалось загрузить рейтинг',
    howItWorksTitle: 'Как рассчитывается рейтинг?',
    howItWorks: {
      intro:
        'Рейтинг отражает результаты спортсмена на текущем турнире в дисциплинах Tactic Control (TC) и Close Control (CC). Ниже — действующая формула и значения, по которым он считается.',
      formulaTitle: 'Формула',
      formulaDiscipline:
        'Сначала считается рейтинг в каждой дисциплине: баллы за место плюс баллы за все зачётные победы, затем применяется возрастной коэффициент.',
      formulaDisciplineExpression:
        'рейтинг дисциплины = округление((баллы за место + баллы за победы) × коэффициент возраста / 100)',
      formulaOverall: 'Общий рейтинг — сумма рейтингов TC и CC.',
      formulaOverallExpression: 'общий рейтинг = рейтинг TC + рейтинг CC',
      placePointsTitle: 'Баллы за место',
      placeWithWinsDescription:
        'Если у спортсмена есть хотя бы одна зачётная победа в дисциплине, место оценивается полностью:',
      placeLabels: {
        first: '1 место',
        second: '2 место',
        third: '3 место',
      },
      placeWithoutWinsDescription: (percent: number) =>
        `Если зачётных побед нет, за место начисляется ${percent}% от полного значения:`,
      victoryPointsTitle: 'Баллы за зачётные победы',
      victoryPointsDescription:
        'К каждой зачётной победе в дисциплине добавляются баллы в зависимости от способа победы:',
      forfeitNote:
        'Неявка и проход без поединка — 0 баллов и не считаются зачётной победой.',
      ageCoefficientsTitle: 'Возрастные коэффициенты',
      ageCoefficientsDescription:
        'Коэффициент зависит от возрастной группы спортсмена и применяется к сумме баллов за место и победы в дисциплине:',
      ageCoefficientsExpression:
        'итог дисциплины = округление((место + победы) × коэффициент / 100)',
      notesTitle: 'Дополнительно',
      notes: (topLimit: number) => [
        `В публичной таблице показаны топ-${topLimit} спортсменов с ненулевым рейтингом в выбранном разделе.`,
        'При равенстве баллов выше место у спортсмена с большим числом зачётных побед, затем болевых/удушающих, медалей и лучшим результатом в одной дисциплине.',
        'Если спортсмен выступил в нескольких категориях одной дисциплины, суммируются баллы за каждую категорию и учитываются все медали.',
        'Общий рейтинг — сумма результатов в TC и CC.',
      ],
    },
    columns: {
      rank: '#',
      athlete: 'Спортсмен',
      age: 'Возраст',
      result: 'Результат',
      wins: 'Победы',
      points: 'Баллы',
    },
    adminColumns: {
      rank: 'Место',
      athlete: 'Спортсмен',
      age: 'Возраст',
      tacticControl: 'TC',
      closeControl: 'CC',
      placements: 'Места',
      wins: 'Победы',
      pointsVictories: 'По очкам',
      submissionChoke: 'Болевые/удушающие',
      injury: 'Травма',
      dq: 'Дисквалификация',
      forfeit: 'Неявка',
      total: 'Итог',
    },
    adminColumnShort: {
      wins: 'Поб.',
      pointsVictories: 'Очки',
      submissionChoke: 'Б/У',
      injury: 'Трав.',
      dq: 'ДК',
      forfeit: 'Неяв.',
    },
    settings: {
      victoryPointsTitle: 'Баллы за победы',
      victoryPoints: {
        pointsVictoryPoints: 'По очкам',
        clearAdvantageVictoryPoints: 'Явное преимущество',
        submissionVictoryPoints: 'Болевой приём',
        chokeVictoryPoints: 'Удушающий приём',
        injuryVictoryPoints: 'Травма',
        dqVictoryPoints: 'Дисквалификация',
      },
      forfeitNote: 'Неявка — 0 баллов, не учитывается как победа.',
      ageCoefficientsTitle: 'Возрастные коэффициенты',
      ageCoefficientLabel: (bracketLabel: string) => `Возраст ${bracketLabel} (%)`,
    },
    unranked: 'Вне рейтингового зачёта — 0 баллов',
  },
  awardsCeremony: {
    title: 'Награждение',
    description: 'Расписание церемоний награждения по категориям.',
    loading: 'Загрузка расписания…',
    backToTournament: '← К соревнованию',
    disabledTitle: 'Раздел недоступен',
    disabledDescription: 'Публичная страница награждения отключена организаторами турнира.',
    loadErrorTitle: 'Не удалось загрузить расписание',
    loadErrorDescription:
      'Попробуйте обновить страницу. Если ошибка повторяется — сообщите организаторам.',
    emptyTitle: 'Расписание награждения пока формируется',
    emptyDescription: 'Как только категории завершат соревнования, они появятся в очереди.',
    filteredEmptyTitle: 'Ничего не найдено',
    filteredEmptyDescription: 'Попробуйте изменить фильтры или сбросить поиск.',
    searchPlaceholder: 'Фамилия, имя, клуб или категория',
    pollingError: 'Не удалось обновить · повторяем',
  },
  timer: {
    title: 'До закрытия регистрации',
    plaqueTitle: 'Цена повысится через',
    closeTitle: 'Регистрация закроется через',
    loading: 'Загрузка…',
    units: { days: 'дней', hours: 'часов', minutes: 'минут', seconds: 'секунд' },
  },
  registration: {
    clubStepTitle: 'Клуб и контакты',
    clubStepHint: 'Контакты тренера или представителя клуба: телефон обязателен, почта — по желанию',
    athletesStepTitle: 'Спортсмены',
    athletesStepHint: 'Данные и категории каждого участника',
    confirmStepTitle: 'Подтверждение',
    personalDataTitle: 'Личные данные',
    middleNameLabel: 'Отчество (необязательно)',
    categoriesTitle: 'Категории участия',
    addAthlete: '+ Добавить спортсмена',
    addCategoryTitle: 'Добавить категорию',
    categoryIncomplete: 'Заполните категорию',
    expandItem: 'Изменить',
    collapseItem: 'Свернуть',
    athleteIncomplete: 'Заполните данные спортсмена',
    ageUpOptionSuffix: 'категория выше',
    divisionLabel: 'Дивизион',
    clubSelectLabel: 'Клуб',
    clubSelectPlaceholder: 'Начните вводить название…',
    clubSelectHint: 'Начните вводить название или выберите клуб из списка',
    consentBlockTitle: 'Подтверждение и согласия',
    summaryAthletes: 'Спортсмены',
    summaryCategories: (count: number, amount: string) => `${count} ${count === 1 ? 'категория' : count < 5 ? 'категории' : 'категорий'} — ${amount}`,
    summaryPaymentNote: 'Тариф при оплате определяется датой отправки квитанции',
    backToTournament: 'Назад к турниру',
    clubListTitle: 'Доступные клубы',
    clubListLoading: 'Загрузка…',
    clubListEmpty: 'В списке пока нет клубов — добавьте свой.',
    clubNotFound: 'Клуб не найден',
    clubAddNew: 'Добавить клуб',
    clubNewName: 'Название клуба',
    clubNewCity: 'Город',
    clubSelected: 'Выбран',
    editCodeLabel: 'Секретный код',
    editCodeNotice: 'Придумайте код для редактирования заявки.',
    editCodeNoticeEmphasis: 'Запомните его.',
    editCodePlaceholder: 'Минимум 4 символа',
    lockedCategoryHint: 'Категория на проверке или оплачена — изменить или удалить нельзя',
    lockedAthleteHint: 'Есть оплаченные или проверяемые категории',
    lockedPersonalHint: 'Нельзя менять: есть подтверждённые категории',
    newCategoryPaymentNote: 'Новая категория потребует отдельной оплаты',
  },
  myRegistrations: {
    title: 'Мои заявки',
    description: 'Здесь заявки, которые вы отправляли с этого телефона или компьютера. Их можно оплатить или изменить.',
    closedActionsNote:
      'Регистрация закрыта. Изменить заявку или оплатить через сайт больше нельзя — обратитесь к организаторам.',
    closedPaymentNote:
      'Регистрация закрыта. Оплатить через сайт больше нельзя — обратитесь к организаторам.',
    listTitle: 'Заявки на этом устройстве',
    empty: 'На этом устройстве заявок пока нет.',
    emptyHint:
      'Если вы уже регистрировались с другого телефона или компьютера, добавьте заявку в этот список — понадобятся телефон или почта из заявки и секретный код, который вы задали при регистрации.',
    loadSectionTitle: 'Не видите свою заявку?',
    loadSectionHint:
      'Зарегистрировались с другого телефона или браузера? Найдите заявку по контактам и секретному коду — она появится в списке выше.',
    loadButton: 'Загрузить мою заявку',
    hideLoadForm: 'Скрыть',
    loadFormTitle: 'Загрузить заявку в список',
    loadFormDescription:
      'Укажите телефон или почту из заявки и секретный код. После проверки заявка появится в списке — сможете оплатить или изменить данные.',
    loadSubmit: 'Загрузить заявку',
  },
} as const

export function formatAgeYears(age: number): string {
  const mod10 = age % 10
  const mod100 = age % 100
  if (mod10 === 1 && mod100 !== 11) return `${age} год`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${age} года`
  return `${age} лет`
}

export function pluralAthletes(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} спортсмен`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} спортсмена`
  return `${count} спортсменов`
}

export function pluralClubs(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} клуб`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} клуба`
  return `${count} клубов`
}

/** Дисциплины участия (Tactic-Control, Close-Control). */
export function pluralDisciplines(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} дисциплина`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} дисциплины`
  return `${count} дисциплин`
}

export function pluralBouts(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} поединок`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} поединка`
  return `${count} поединков`
}

/** Записи в категориях: у одного спортсмена может быть несколько. */
export function pluralCategories(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} категория`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} категории`
  return `${count} категорий`
}

export function pluralMedalists(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} призёр`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${count} призёра`
  return `${count} призёров`
}
