// 创建信息科技核心素养节点（顶层概念）
CREATE
(info_tech:CoreLiteracy {name: '信息科技核心素养', level: '顶层', description: '学生通过信息科技课程学习逐步形成的正确价值观、必备品格和关键能力'}),

// 创建四大核心素养节点
(info_consciousness:CoreLiteracy {name: '信息意识', level: '核心素养', description: '个体对信息的敏感度和对信息价值的判断力'}),
(computational_thinking:CoreLiteracy {name: '计算思维', level: '核心素养', description: '运用计算机科学思想方法解决问题的思维活动'}),
(digital_learning:CoreLiteracy {name: '数字化学习与创新', level: '核心素养', description: '利用数字化资源工具创造性解决问题的能力'}),
(info_social_responsibility:CoreLiteracy {name: '信息社会责任', level: '核心素养', description: '信息社会中应尽的文化修养、道德规范责任'}),

// 创建信息意识的子维度节点
(info_perception:SubDimension {name: '信息感知力', level: '子维度', description: '具有一定的信息感知力，熟悉信息呈现与传递方式'}),
(data_evaluation:SubDimension {name: '数据评估力', level: '子维度', description: '评估数据来源，判断数据可靠性和时效性'}),
(active_application:SubDimension {name: '主动应用力', level: '子维度', description: '寻找有效数字平台解决问题的意愿'}),
(science_spirit:SubDimension {name: '崇尚科学精神', level: '子维度', description: '崇尚科学精神、原创精神'}),
(problem_solving:SubDimension {name: '问题解决力', level: '子维度', description: '自主动手解决问题、掌握核心技术的意识'}),
(legal_awareness:SubDimension {name: '法律意识', level: '子维度', description: '保护隐私，依法应用信息的意识'}),

// 创建计算思维的子维度节点
(solution_design:SubDimension {name: '提出解决方案', level: '子维度', description: '对问题进行抽象、分解、建模，设计算法形成解决方案'}),
(problem_resolution:SubDimension {name: '尝试解决问题', level: '子维度', description: '模拟、仿真、验证解决过程，优化方案并迁移应用'}),

// 创建课程内容模块节点
(data_algorithm:ContentModule {name: '数据与编码', level: '内容模块', category: '基础知识'}),
(online_learning:ContentModule {name: '在线学习与生活', level: '内容模块', category: '应用技能'}),
(info_security:ContentModule {name: '信息隐私与安全', level: '内容模块', category: '安全素养'}),
(ai_technology:ContentModule {name: '人工智能与智慧社会', level: '内容模块', category: '前沿技术'})

// 建立核心素养之间的关联关系
;
MATCH (tech:CoreLiteracy {name: '信息科技核心素养'}),
      (ic:CoreLiteracy {name: '信息意识'}),
      (ct:CoreLiteracy {name: '计算思维'}),
      (dl:CoreLiteracy {name: '数字化学习与创新'}),
      (isr:CoreLiteracy {name: '信息社会责任'})
CREATE
(tech)-[:INCLUDES]->(ic),
(tech)-[:INCLUDES]->(ct),
(tech)-[:INCLUDES]->(dl),
(tech)-[:INCLUDES]->(isr),
(ic)-[:SUPPORTS]->(ct),
(ct)-[:SUPPORTS]->(dl),
(dl)-[:REQUIRES]->(isr),
(isr)-[:PROTECTS]->(ic)

// 建立信息意识子维度关系
;
MATCH (ic:CoreLiteracy {name: '信息意识'}),
      (ip:SubDimension {name: '信息感知力'}),
      (de:SubDimension {name: '数据评估力'}),
      (aa:SubDimension {name: '主动应用力'}),
      (ss:SubDimension {name: '崇尚科学精神'}),
      (ps:SubDimension {name: '问题解决力'}),
      (la:SubDimension {name: '法律意识'})
CREATE
(ic)-[:HAS_DIMENSION]->(ip),
(ic)-[:HAS_DIMENSION]->(de),
(ic)-[:HAS_DIMENSION]->(aa),
(ic)-[:HAS_DIMENSION]->(ss),
(ic)-[:HAS_DIMENSION]->(ps),
(ic)-[:HAS_DIMENSION]->(la)

// 建立计算思维子维度关系
;
MATCH (ct:CoreLiteracy {name: '计算思维'}),
      (sd:SubDimension {name: '提出解决方案'}),
      (pr:SubDimension {name: '尝试解决问题'})
CREATE
(ct)-[:HAS_DIMENSION]->(sd),
(ct)-[:HAS_DIMENSION]->(pr),
(sd)-[:PRECEDES]->(pr)

// 建立素养与课程内容的对应关系
;
MATCH (ic:CoreLiteracy {name: '信息意识'}),
      (ct:CoreLiteracy {name: '计算思维'}),
      (dl:CoreLiteracy {name: '数字化学习与创新'}),
      (isr:CoreLiteracy {name: '信息社会责任'}),
      (da:ContentModule {name: '数据与编码'}),
      (ol:ContentModule {name: '在线学习与生活'}),
      (isec:ContentModule {name: '信息隐私与安全'}),
      (ai:ContentModule {name: '人工智能与智慧社会'})
CREATE
(ic)-[:DEVELOPED_BY]->(ol),
(ic)-[:DEVELOPED_BY]->(isec),
(ct)-[:DEVELOPED_BY]->(da),
(ct)-[:DEVELOPED_BY]->(ai),
(dl)-[:DEVELOPED_BY]->(ol),
(dl)-[:DEVELOPED_BY]->(ai),
(isr)-[:DEVELOPED_BY]->(isec),
(isr)-[:DEVELOPED_BY]->(da)

// 创建学段节点并建立关系
;
CREATE
(lower_primary:GradeLevel {name: '小学低段', focus: '信息生活体验'}),
(upper_primary:GradeLevel {name: '小学中高段', focus: '信息概念及基本原理掌握'}),
(junior_high:GradeLevel {name: '初中', focus: '与生活情境联结，接触计算机科学概念'}),
(senior_high:GradeLevel {name: '高中', focus: '发现问题、创造性思考、表达解决方案能力'})

// 建立学段与核心素养的发展关系
;
MATCH (lp:GradeLevel {name: '小学低段'}),
      (up:GradeLevel {name: '小学中高段'}),
      (jh:GradeLevel {name: '初中'}),
      (sh:GradeLevel {name: '高中'}),
      (ic:CoreLiteracy {name: '信息意识'}),
      (ct:CoreLiteracy {name: '计算思维'}),
      (dl:CoreLiteracy {name: '数字化学习与创新'}),
      (isr:CoreLiteracy {name: '信息社会责任'})
CREATE
(lp)-[:DEVELOPS {weight: 0.3}]->(ic),
(lp)-[:DEVELOPS {weight: 0.1}]->(ct),
(up)-[:DEVELOPS {weight: 0.5}]->(ic),
(up)-[:DEVELOPS {weight: 0.3}]->(ct),
(jh)-[:DEVELOPS {weight: 0.7}]->(ic),
(jh)-[:DEVELOPS {weight: 0.6}]->(ct),
(jh)-[:DEVELOPS {weight: 0.5}]->(dl),
(sh)-[:DEVELOPS {weight: 0.9}]->(ic),
(sh)-[:DEVELOPS {weight: 0.8}]->(ct),
(sh)-[:DEVELOPS {weight: 0.7}]->(dl),
(sh)-[:DEVELOPS {weight: 0.8}]->(isr)

// 返回创建结果统计
;
RETURN
'信息科技核心素养图谱创建完成' as result,
COUNT { MATCH (n) } as total_nodes,
COUNT { MATCH (n:CoreLiteracy) } as core_literacy_nodes,
COUNT { MATCH (n:SubDimension) } as subdimension_nodes,
COUNT { MATCH (n:ContentModule) } as content_module_nodes,
COUNT { MATCH (n:GradeLevel) } as grade_level_nodes;

// 批量为课程内容模块添加题目
UNWIND [
    // --- 1. 数据与编码 ---
    {
        target: '数据与编码',
        content: '计算机内部存储和处理数据的最小单位是？',
        type: '单选题',
        options: 'A. 字节 (Byte); B. 位 (Bit); C. 字符; D. 像素',
        answer: 'B',
        analysis: '位（Bit）是计算机最小的存储单位，字节（Byte）是基本单位。'
    },
    {
        target: '数据与编码',
        content: 'ASCII码主要用于表示哪种类型的信息？',
        type: '单选题',
        options: 'A. 汉字; B. 英文字符和数字; C. 图像; D. 音频',
        answer: 'B',
        analysis: 'ASCII码是基于拉丁字母的一套电脑编码系统。'
    },

    // --- 2. 在线学习与生活 ---
    {
        target: '在线学习与生活',
        content: '在在线课堂中，以下哪种行为是恰当的？',
        type: '单选题',
        options: 'A. 随意刷屏聊天; B. 未经允许开启麦克风喧哗; C. 按规则发言并尊重他人; D. 传播虚假信息',
        answer: 'C',
        analysis: '网络礼仪是数字化学习的重要组成部分。'
    },
    {
        target: '在线学习与生活',
        content: '利用思维导图工具整理学习笔记属于数字化学习中的哪种应用？',
        type: '单选题',
        options: 'A. 休闲娱乐; B. 认知工具应用; C. 硬件维护; D. 编程开发',
        answer: 'B',
        analysis: '利用工具辅助思维属于认知工具的应用。'
    },

    // --- 3. 信息隐私与安全 ---
    {
        target: '信息隐私与安全',
        content: '为了保护账号安全，设置密码时应避免：',
        type: '单选题',
        options: 'A. 使用大小写字母混合; B. 使用生日或手机号; C. 包含特殊符号; D. 定期更换',
        answer: 'B',
        analysis: '使用个人公开信息作为密码极易被破解。'
    },
    {
        target: '信息隐私与安全',
        content: '连接公共场所的免费Wi-Fi进行支付操作是安全的。',
        type: '判断题',
        options: 'A. 正确; B. 错误',
        answer: 'B',
        analysis: '公共Wi-Fi存在被窃听风险，不应进行敏感资金操作。'
    },

    // --- 4. 人工智能与智慧社会 ---
    {
        target: '人工智能与智慧社会',
        content: '下列哪项应用属于典型的计算机视觉技术？',
        type: '单选题',
        options: 'A. 语音输入法; B. 刷脸进站; C. 智能音箱; D. 垃圾邮件过滤',
        answer: 'B',
        analysis: '人脸识别是计算机视觉的核心应用之一。'
    },
    {
        target: '人工智能与智慧社会',
        content: '人工智能的发展应遵循“科技向善”的伦理原则。',
        type: '判断题',
        options: 'A. 正确; B. 错误',
        answer: 'A',
        analysis: 'AI伦理要求技术发展必须造福人类社会。'
    }
] AS data

// 1. 查找对应的课程模块节点
MATCH (cm:ContentModule {name: data.target})

// 2. 创建题目节点
CREATE (q:Question {
    content: data.content,
    type: data.type,
    options: data.options,
    answer: data.answer,
    analysis: data.analysis,
    created_at: datetime()
})

// 3. 建立关联：题目 -> 考察 -> 课程模块
CREATE (q)-[:TESTS]->(cm);